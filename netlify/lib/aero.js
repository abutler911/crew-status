// Shared FlightAware AeroAPI helpers. Used by the live-status endpoint
// (functions/flightstatus.js) and the background notifier (functions/notify.js)
// so the flight-matching logic lives in exactly one place.

export const AEROAPI = "https://aeroapi.flightaware.com/aeroapi";

// FlightAware identifies flights by ICAO airline code (Delta is DAL, not DL).
// Same translation the app uses for its FlightAware links.
export const IATA_TO_ICAO = {
  DL: "DAL", AA: "AAL", UA: "UAL", WN: "SWA", AS: "ASA", B6: "JBU", F9: "FFT",
  NK: "NKS", HA: "HAL", G4: "AAY", SY: "SCX",
  OO: "SKW", "9E": "EDV", YX: "RPA", MQ: "ENY", OH: "JIA", YV: "ASH",
  G7: "GJS", QX: "QXE", ZW: "AWI", PT: "PDT", CP: "CPZ",
  AF: "AFR", KL: "KLM", LH: "DLH", BA: "BAW", VS: "VIR", AM: "AMX",
  AC: "ACA", WS: "WJA", KE: "KAL", VA: "VOZ",
};

// "DL 2014" / "DH DL2014" -> "DAL2014" (ICAO). Drops a deadhead "DH" marker.
export function toIdent(flight) {
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
export function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// "YYYY-MM-DD" for a UTC instant as seen in an IANA timezone, or null if the
// zone string is unusable. en-CA formats as ISO.
function localDateAt(epochMs, tz) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(epochMs);
  } catch {
    return null;
  }
}

// Picks the AeroAPI flight that best matches a leg. AeroAPI returns several
// days of the same flight number, and leg.date/leg.depart are origin-local, so
// UTC-date proximity alone picks the wrong day for evening departures (a 9 PM
// MDT departure is 3 AM UTC the *next* day — closer to the previous day's
// instance). Match on the origin-local calendar date instead, using the
// timezone AeroAPI reports for the origin airport; fall back to time proximity
// only when no candidate's local date lines up.
export function pickFlight(flights, leg) {
  if (!Array.isArray(flights) || flights.length === 0) return null;
  const from = (leg.from || "").toUpperCase();
  // Proximity target: the leg's local departure clock treated as UTC. The
  // zone offset shifts every candidate's score equally across days, so the
  // right day still scores lowest — unlike the old noon-UTC anchor.
  const hhmm = /^\d{2}:\d{2}$/.test(leg.depart || "") ? leg.depart : "12:00";
  const target = new Date(`${leg.date}T${hhmm}:00Z`).getTime();

  const sameLocalDate = [];
  const unknownDate = [];
  for (const f of flights) {
    const origin = f.origin || {};
    const oc = (origin.code_iata || origin.code || "").toUpperCase();
    if (from && oc && oc !== from) continue;
    const sched = f.scheduled_out || f.estimated_out || f.scheduled_off;
    if (!sched) continue;
    const at = new Date(sched).getTime();
    const localDate = origin.timezone ? localDateAt(at, origin.timezone) : null;
    // A flight known to depart on a different local calendar day is a
    // different day's instance — never a fallback candidate.
    if (localDate && localDate !== leg.date) continue;
    const cand = { f, score: Math.abs(at - target) };
    (localDate ? sameLocalDate : unknownDate).push(cand);
  }

  const pool = sameLocalDate.length > 0 ? sameLocalDate : unknownDate;
  const active = pool.filter((c) => !c.f.cancelled);
  const prefer = active.length > 0 ? active : pool;
  let best = null;
  for (const c of prefer) {
    if (!best || c.score < best.score) best = c;
  }
  if (!best) return null;
  // A local-date match is trusted outright. Without timezone info, only trust
  // a candidate within 12h of the target: the right day's flight always is
  // (its score is just the zone offset), while any other day's is 24h off it.
  if (sameLocalDate.length > 0 || best.score < 12 * 3600000) return best.f;
  return null;
}

export function normalize(f) {
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
    progress: typeof f.progress_percent === "number" ? f.progress_percent : null,
  };
}

// Fetches and normalizes the live status for one leg, or null if nothing
// matched / the request failed. `key` is the AeroAPI key.
export async function fetchStatus(key, ident, leg) {
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
