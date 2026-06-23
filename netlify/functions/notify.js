// Background notifier. Netlify runs this on a schedule (see the config export
// at the bottom). Each run it:
//   1. bails early if push isn't configured or nobody is subscribed,
//   2. fetches live AeroAPI status for the current trip's near-term legs,
//   3. compares against the last-seen state and, on a real transition
//      (departed / landed / a worse delay), pushes a notification to every
//      subscribed device,
//   4. saves the new state so each event fires exactly once.
//
// State lives in a single small blob so it can't accumulate: if the trip's set
// of legs changes, we start the state fresh.

import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";
import webpush from "web-push";
import { toIdent, fetchStatus } from "../lib/aero.js";
import { SUBS_STORE } from "./push.js";

const TRIPS_STORE = "trips";
const TRIP_KEY = "current";
const STATE_STORE = "notify-state";
const STATE_KEY = "current";

const DELAY_FLOOR_MIN = 15; // ignore delays smaller than this
const DELAY_BUCKET_MIN = 30; // only re-notify when the delay grows by a bucket

function legKeyOf(leg) {
  return `${leg.flight}|${leg.date}`;
}

// A signature of the trip's legs, so we can tell when the trip itself changed
// (a new trip, edited times) and reset notification state.
function tripSignature(legs) {
  const basis = legs.map((l) => `${l.flight}|${l.date}|${l.depart}|${l.arrive}`).join(";");
  return createHash("sha256").update(basis).digest("hex").slice(0, 16);
}

// Is this leg worth a live lookup right now? Trips auto-expire two days after
// the last leg, so date-proximity keeps us to legs around "now" and bounds the
// number of AeroAPI calls per run.
function nearNow(leg, now) {
  const day = new Date(leg.date + "T00:00:00Z").getTime();
  const ms = now.getTime() - day;
  return ms >= -36 * 3600 * 1000 && ms <= 48 * 3600 * 1000;
}

function place(code, city) {
  return city || code || "";
}

// Builds the notifications a single leg's status change warrants, mutating its
// per-leg state record in place. Returns an array of { title, body, tag }.
function eventsForLeg(leg, status, prev) {
  const events = [];
  const num = (leg.flight || "").replace(/^DH\s*/i, "").trim();
  const from = place(leg.from, leg.fromCity);
  const to = place(leg.to, leg.toCity);
  const route = `${from} → ${to}`;
  const dh = /^DH\b/i.test((leg.flight || "").trim());
  const who = dh ? "Babe-a (deadheading)" : "Babe-a";
  const lk = legKeyOf(leg);

  if (status.actualOut && !prev.departed) {
    prev.departed = true;
    events.push({
      title: `✈️ ${num} departed`,
      body: `${who} just left ${from}, headed to ${to}.`,
      tag: `${lk}|departed`,
    });
  }

  if (status.actualIn && !prev.landed) {
    prev.landed = true;
    events.push({
      title: `🛬 ${num} landed`,
      body: `${who} is on the ground in ${to}.`,
      tag: `${lk}|landed`,
    });
  }

  // Delay: before departure use the departure delay, after it use the arrival
  // delay. Only notify when it crosses the floor and grows by a fresh bucket.
  if (!prev.landed) {
    const delaySec = status.actualOut
      ? status.arrivalDelay
      : status.departureDelay;
    const delayMin = typeof delaySec === "number" ? Math.round(delaySec / 60) : 0;
    if (delayMin >= DELAY_FLOOR_MIN) {
      const bucket = Math.floor(delayMin / DELAY_BUCKET_MIN);
      if (bucket > (prev.delayBucket || 0)) {
        prev.delayBucket = bucket;
        events.push({
          title: `⏱ ${num} running late`,
          body: `${route} is about ${delayMin} min behind schedule.`,
          tag: `${lk}|delay-${bucket}`,
        });
      }
    }
  }

  return events;
}

// Sends one payload to every subscription, pruning the ones the push service
// reports as gone (404 / 410).
async function fanOut(subsStore, payload) {
  let list;
  try {
    list = await subsStore.list();
  } catch {
    return;
  }
  const body = JSON.stringify(payload);
  for (const { key } of list.blobs || []) {
    let rec;
    try {
      rec = await subsStore.get(key, { type: "json" });
    } catch {
      continue;
    }
    if (!rec || !rec.subscription) continue;
    try {
      await webpush.sendNotification(rec.subscription, body);
    } catch (e) {
      const code = e && e.statusCode;
      if (code === 404 || code === 410) {
        try {
          await subsStore.delete(key);
        } catch {}
      }
    }
  }
}

export default async () => {
  const aeroKey = process.env.AEROAPI_KEY;
  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;
  if (!aeroKey || !vapidPublic || !vapidPrivate || !vapidSubject) {
    return new Response("not configured", { status: 200 });
  }

  const subsStore = getStore(SUBS_STORE);
  // No subscribers? Don't spend any AeroAPI lookups.
  let subList;
  try {
    subList = await subsStore.list();
  } catch {
    subList = { blobs: [] };
  }
  if (!subList.blobs || subList.blobs.length === 0) {
    return new Response("no subscribers", { status: 200 });
  }

  const tripsStore = getStore(TRIPS_STORE);
  let trip = null;
  try {
    trip = await tripsStore.get(TRIP_KEY, { type: "json" });
  } catch {}
  const legs = trip && Array.isArray(trip.legs) ? trip.legs : [];
  if (legs.length === 0) {
    return new Response("no trip", { status: 200 });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const stateStore = getStore(STATE_STORE);
  let state = null;
  try {
    state = await stateStore.get(STATE_KEY, { type: "json" });
  } catch {}
  const sig = tripSignature(legs);
  if (!state || state.sig !== sig) {
    state = { sig, legs: {} };
  }

  const now = new Date();
  let changed = false;

  for (const leg of legs) {
    if (!leg.date || !leg.flight) continue;
    const lk = legKeyOf(leg);
    const prev = state.legs[lk] || { departed: false, landed: false, delayBucket: 0 };

    // Already done with this leg, or it's not near "now": skip the lookup.
    if (prev.departed && prev.landed) {
      state.legs[lk] = prev;
      continue;
    }
    if (!nearNow(leg, now)) {
      state.legs[lk] = prev;
      continue;
    }

    const ident = toIdent(leg.flight);
    if (!ident) {
      state.legs[lk] = prev;
      continue;
    }

    const status = await fetchStatus(aeroKey, ident, leg);
    if (status) {
      const events = eventsForLeg(leg, status, prev);
      for (const ev of events) {
        await fanOut(subsStore, { ...ev, url: "/" });
        changed = true;
      }
    }
    state.legs[lk] = prev;
  }

  if (changed || !state.savedAt) {
    state.savedAt = Date.now();
    try {
      await stateStore.setJSON(STATE_KEY, state);
    } catch {}
  }

  return new Response("ok", { status: 200 });
};

// Every 5 minutes. Netlify only runs this for deploys on the production branch.
export const config = { schedule: "*/5 * * * *" };
