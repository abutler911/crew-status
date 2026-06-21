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

const AEROAPI = "https://aeroapi.flightaware.com/aeroapi";
const TTL_MS = 3 * 60 * 1000; // serve cached status for 3 minutes
const MAX_LEGS = 12; // safety cap on lookups per request

// FlightAware identifies flights by ICAO airline code (Delta is DAL, not DL).
// Same translation the app uses for its FlightAware links.
const IATA_TO_ICAO = {
  DL: "DAL", AA: "AAL", UA: "UAL", WN: "SWA", AS: "ASA", B6: "JBU", F9: "FFT",
  NK: "NKS", HA: "HAL", G4: "AAY", SY: "SCX",
  OO: "SKW", "9E": "EDV", YX: "RPA", MQ: "ENY", OH: "JIA", YV: "ASH",
  G7: "GJS", QX: "QXE", ZW: "AWI", PT: "PDT", CP: "CPZ",
  AF: "AFR", KL: "KLM", LH: "DLH", BA: "BAW", VS: "VIR", AM: "AMX",
  AC: "ACA", WS: "WJA", KE: "KAL", VA: "VOZ",
};

function norm(s) {
  return (s || "").replace(/\s+/g, "").toLowerCase();
}

function roleOf(req) {
  const c = norm(req.headers.get("x-access-code"));
  if (c && c === norm(process.env.ADMIN_CODE)) return "admin";
  if (c && c === norm(process.env.VIEW_CODE)) return "view";
  return null;
}

// "DL 2014" / "DH DL2014" -> "DAL2014" (ICAO). Drops a deadhead "DH" marker.
function toIdent(flight) {
  const raw = (flight || "")
    .replace(/^DH\s*/i, "")
    .replace(/\s+/g, "")
    .toUpperCase();
  const m = raw.match(/^([A-Z0-9]*?)(\d+)$/);
  if (!m) return raw || null;
  const code = m[1];
  return (IATA_TO_ICAO[code] || code) + m[2];
}

// "YYYY-MM-DD" plus n days.
function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Picks the AeroAPI flight that best matches a leg: same origin airport, and
// the scheduled-out date closest to the leg's date. Guards against AeroAPI
// returning several days of the same flight number.
function pickFlight(flights, leg) {
  if (!Array.isArray(flights) || flights.length === 0) return null;
  const from = (leg.from || "").toUpperCase();
  const target = new Date(leg.date + "T12:00:00Z").getTime();
  let best = null;
  let bestScore = Infinity;
  for (const f of flights) {
    const origin = f.origin || {};
    const oc = (origin.code_iata || origin.code || "").toUpperCase();
    if (from && oc && oc !== from) continue;
    const sched = f.scheduled_out || f.estimated_out || f.scheduled_off;
    if (!sched) continue;
    const score = Math.abs(new Date(sched).getTime() - target);
    if (score < bestScore) {
      bestScore = score;
      best = f;
    }
  }
  // Only trust the match if it lands within ~1.5 days of the leg's date.
  if (best && bestScore <= 1.5 * 86400000) return best;
  return null;
}

function normalize(f) {
  return {
    status: f.status || "",
    cancelled: !!f.cancelled,
    diverted: !!f.diverted,
    departureDelay: typeof f.departure_delay === "number" ? f.departure_delay : null,
    arrivalDelay: typeof f.arrival_delay === "number" ? f.arrival_delay : null,
    estOut: f.estimated_out || null,
    actualOut: f.actual_out || null,
    estIn: f.estimated_in || null,
    actualIn: f.actual_in || null,
    gateOrigin: f.gate_origin || null,
    gateDestination: f.gate_destination || null,
    terminalDestination: f.terminal_destination || null,
    baggage: f.baggage_claim || null,
    progress: typeof f.progress_percent === "number" ? f.progress_percent : null,
  };
}

async function fetchStatus(key, ident, leg) {
  const params = new URLSearchParams({
    start: addDays(leg.date, -1),
    end: addDays(leg.date, 2),
    max_pages: "1",
  });
  let res;
  try {
    res = await fetch(`${AEROAPI}/flights/${encodeURIComponent(ident)}?${params}`, {
      headers: { "x-apikey": key, Accept: "application/json" },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  let data;
  try {
    data = await res.json();
  } catch {
    return null;
  }
  const match = pickFlight(data.flights, leg);
  return match ? normalize(match) : null;
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

  for (const leg of legs) {
    const ident = toIdent(leg.flight);
    if (!ident || !leg.date) continue;
    const legKey = `${leg.flight}|${leg.date}`;
    const cacheKey = `${ident}-${leg.date}-${(leg.from || "").toUpperCase()}`;

    let cached = null;
    try {
      cached = await store.get(cacheKey, { type: "json" });
    } catch {}
    if (cached && Date.now() - cached.at < TTL_MS) {
      if (cached.data) statuses[legKey] = cached.data;
      continue;
    }

    const data = await fetchStatus(key, ident, leg);
    try {
      await store.setJSON(cacheKey, { at: Date.now(), data });
    } catch {}
    if (data) statuses[legKey] = data;
  }

  return Response.json({ statuses });
};
