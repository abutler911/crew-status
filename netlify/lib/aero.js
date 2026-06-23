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

// Picks the AeroAPI flight that best matches a leg: same origin airport, and
// the scheduled-out date closest to the leg's date. Guards against AeroAPI
// returning several days of the same flight number.
export function pickFlight(flights, leg) {
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
