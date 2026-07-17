// Live flight status from FlightAware AeroAPI, so the board can show real
// delays / departures / landings instead of just the printed schedule.
//
// POST /api/flightstatus  body: { legs: [{ flight, date, from, to }, ...] }
//   -> { statuses: { "<flight>|<date>": {normalized status}, ... } }
//
// Needs a valid code (view or admin) in the "x-access-code" header. The AeroAPI
// key stays server-side. Results are cached in Netlify Blobs for a few minutes
// so repeated viewer polls (and multiple viewers) don't each spend a lookup.

import { getStore } from "@netlify/blobs";
import { toIdent, fetchStatus } from "../lib/aero.js";

const TTL_MS = 3 * 60 * 1000; // serve cached status for 3 minutes
const MAX_LEGS = 12; // safety cap on lookups per request

function norm(s) {
  return (s || "").replace(/\s+/g, "").toLowerCase();
}

function roleOf(req) {
  const c = norm(req.headers.get("x-access-code"));
  if (c && c === norm(process.env.ADMIN_CODE)) return "admin";
  if (c && c === norm(process.env.VIEW_CODE)) return "view";
  return null;
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const role = roleOf(req);
  if (role !== "admin" && role !== "view") {
    return new Response("Unauthorized", { status: 401 });
  }

  const key = process.env.AEROAPI_KEY;
  // No key configured: succeed quietly with no statuses, so the board just
  // falls back to the printed schedule instead of erroring.
  if (!key) return Response.json({ statuses: {} });

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  const legs = Array.isArray(body.legs) ? body.legs.slice(0, MAX_LEGS) : [];

  const store = getStore("flightstatus");
  const statuses = {};

  // Legs are looked up in parallel: each one costs a blob read and possibly an
  // AeroAPI call, and doing them serially made a cache-miss trip take seconds.
  await Promise.all(
    legs.map(async (leg) => {
      const ident = toIdent(leg.flight);
      if (!ident || !leg.date) return;
      const legKey = `${leg.flight}|${leg.date}`;
      const cacheKey = `${ident}-${leg.date}-${(leg.from || "").toUpperCase()}`;

      let cached = null;
      try {
        cached = await store.get(cacheKey, { type: "json" });
      } catch {}
      if (cached && Date.now() - cached.at < TTL_MS) {
        if (cached.data) statuses[legKey] = cached.data;
        return;
      }

      const data = await fetchStatus(key, ident, leg);
      try {
        await store.setJSON(cacheKey, { at: Date.now(), data });
      } catch {}
      if (data) statuses[legKey] = data;
    }),
  );

  return Response.json({ statuses });
};
