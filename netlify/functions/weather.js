// Current weather at trip destinations, via Open-Meteo (no API key required).
//
// POST /api/weather  body: { places: [{ code, city }, ...] }
//   -> { weather: { "<CODE>": { tempF, emoji, label }, ... } }
//
// Needs a valid code (view or admin) in the "x-access-code" header. Geocoding
// (city -> lat/lon) and the forecast are both cached in Netlify Blobs so we
// don't re-hit Open-Meteo on every viewer poll: coordinates effectively never
// change, and conditions are refreshed every ~30 minutes.

import { getStore } from "@netlify/blobs";

const GEOCODE = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST = "https://api.open-meteo.com/v1/forecast";
const WX_TTL_MS = 30 * 60 * 1000; // refresh good conditions every 30 min
const WX_NEG_TTL_MS = 5 * 60 * 1000; // but retry a failed lookup within 5 min
const GEO_TTL_MS = 180 * 24 * 3600 * 1000; // good coordinates: basically forever
const GEO_NEG_TTL_MS = 6 * 3600 * 1000; // retry a failed geocode within hours
const MAX_PLACES = 12;

// Approximate (metro-level, plenty for weather) coordinates for the airports
// the app supports, so weather doesn't depend on a parsed city name being
// present or unambiguous. Anything not listed falls back to city geocoding.
const AIRPORT_COORDS = {
  // Mountain
  SLC: [40.79, -111.98], DEN: [39.86, -104.67], ABQ: [35.04, -106.61],
  COS: [38.81, -104.7], BOI: [43.56, -116.22], GJT: [39.12, -108.53],
  BZN: [45.78, -111.15], JAC: [43.61, -110.74], PHX: [33.43, -112.01],
  TUS: [32.12, -110.94],
  // Pacific
  LAX: [33.94, -118.41], SFO: [37.62, -122.38], SAN: [32.73, -117.19],
  SJC: [37.36, -121.93], OAK: [37.71, -122.22], SMF: [38.7, -121.59],
  SNA: [33.68, -117.87], BUR: [34.2, -118.36], ONT: [34.06, -117.6],
  PDX: [45.59, -122.6], SEA: [47.45, -122.31], GEG: [47.62, -117.53],
  RNO: [39.5, -119.77], LAS: [36.08, -115.15], FAT: [36.78, -119.72],
  // Alaska / Hawaii
  ANC: [61.17, -149.99], FAI: [64.82, -147.86], JNU: [58.35, -134.58],
  HNL: [21.32, -157.92], OGG: [20.9, -156.43], KOA: [19.74, -156.05],
  // Central
  ORD: [41.98, -87.9], MDW: [41.79, -87.75], DFW: [32.9, -97.04],
  IAH: [29.99, -95.34], HOU: [29.65, -95.28], MSY: [29.99, -90.26],
  MSP: [44.88, -93.22], STL: [38.75, -90.37], MCI: [39.3, -94.71],
  OMA: [41.3, -95.89], OKC: [35.39, -97.6], TUL: [36.2, -95.89],
  MEM: [35.04, -89.98], BNA: [36.12, -86.68], AUS: [30.19, -97.67],
  SAT: [29.53, -98.47], ICT: [37.65, -97.43], DSM: [41.53, -93.66],
  MKE: [42.95, -87.9], FAR: [46.92, -96.82], LIT: [34.73, -92.22],
  // Eastern
  ATL: [33.64, -84.43], BOS: [42.36, -71.01], JFK: [40.64, -73.78],
  LGA: [40.78, -73.87], EWR: [40.69, -74.17], DCA: [38.85, -77.04],
  IAD: [38.95, -77.46], BWI: [39.18, -76.67], PHL: [39.87, -75.24],
  CLT: [35.21, -80.94], RDU: [35.88, -78.79], MCO: [28.43, -81.31],
  MIA: [25.79, -80.29], FLL: [26.07, -80.15], TPA: [27.98, -82.53],
  PBI: [26.68, -80.1], JAX: [30.49, -81.69], RSW: [26.54, -81.75],
  PIT: [40.49, -80.23], CLE: [41.41, -81.85], CMH: [40.0, -82.89],
  CVG: [39.05, -84.67], IND: [39.72, -86.29], DTW: [42.21, -83.35],
  BUF: [42.94, -78.73], ROC: [43.12, -77.67], SYR: [43.11, -76.11],
  BDL: [41.94, -72.68], PVD: [41.73, -71.43], ALB: [42.75, -73.8],
  ORF: [36.89, -76.2], RIC: [37.51, -77.32], SAV: [32.13, -81.2],
  CHS: [32.9, -80.04], GSP: [34.9, -82.22], GSO: [36.1, -79.94],
  // International
  YYZ: [43.68, -79.61], YVR: [49.19, -123.18], YUL: [45.47, -73.74],
  CUN: [21.04, -86.87], MEX: [19.44, -99.07], LHR: [51.47, -0.45],
  CDG: [49.01, 2.55], AMS: [52.31, 4.76], FRA: [50.04, 8.56],
  FCO: [41.8, 12.25], MAD: [40.47, -3.56], NRT: [35.77, 140.39],
  HND: [35.55, 139.78], ICN: [37.46, 126.44], PVG: [31.14, 121.81],
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

// WMO weather code -> { emoji, label }. `isDay` swaps sun/moon for clear skies.
function describeWmo(code, isDay) {
  const sun = isDay ? "☀️" : "🌙";
  const map = {
    0: [sun, "Clear"],
    1: [isDay ? "🌤️" : "🌙", "Mostly clear"],
    2: ["⛅", "Partly cloudy"],
    3: ["☁️", "Overcast"],
    45: ["🌫️", "Fog"],
    48: ["🌫️", "Fog"],
    51: ["🌦️", "Light drizzle"],
    53: ["🌦️", "Drizzle"],
    55: ["🌦️", "Heavy drizzle"],
    56: ["🌧️", "Freezing drizzle"],
    57: ["🌧️", "Freezing drizzle"],
    61: ["🌧️", "Light rain"],
    63: ["🌧️", "Rain"],
    65: ["🌧️", "Heavy rain"],
    66: ["🌧️", "Freezing rain"],
    67: ["🌧️", "Freezing rain"],
    71: ["🌨️", "Light snow"],
    73: ["🌨️", "Snow"],
    75: ["🌨️", "Heavy snow"],
    77: ["🌨️", "Snow"],
    80: ["🌦️", "Showers"],
    81: ["🌦️", "Showers"],
    82: ["🌦️", "Heavy showers"],
    85: ["🌨️", "Snow showers"],
    86: ["🌨️", "Snow showers"],
    95: ["⛈️", "Thunderstorm"],
    96: ["⛈️", "Thunderstorm"],
    99: ["⛈️", "Thunderstorm"],
  };
  const [emoji, label] = map[code] || ["🌡️", ""];
  return { emoji, label };
}

async function geocode(store, code, city) {
  const cacheKey = `geo-${code}`;
  try {
    const cached = await store.get(cacheKey, { type: "json" });
    if (cached) {
      const ttl = cached.coords ? GEO_TTL_MS : GEO_NEG_TTL_MS;
      if (Date.now() - cached.at < ttl) return cached.coords;
    }
  } catch {}
  if (!city) return null;
  let coords = null;
  try {
    const params = new URLSearchParams({ name: city, count: "1" });
    const res = await fetch(`${GEOCODE}?${params}`, {
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      const hit = (data.results || [])[0];
      if (hit) coords = { lat: hit.latitude, lon: hit.longitude };
    }
  } catch {}
  // Cache even a null so a bad/unknown city doesn't get geocoded every poll.
  try {
    await store.setJSON(cacheKey, { at: Date.now(), coords });
  } catch {}
  return coords;
}

async function forecast(coords) {
  try {
    const params = new URLSearchParams({
      latitude: String(coords.lat),
      longitude: String(coords.lon),
      current: "temperature_2m,weather_code,is_day",
      temperature_unit: "fahrenheit",
      timezone: "auto",
    });
    const res = await fetch(`${FORECAST}?${params}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const cur = data.current;
    if (!cur) return null;
    const { emoji, label } = describeWmo(cur.weather_code, cur.is_day === 1);
    return { tempF: Math.round(cur.temperature_2m), emoji, label };
  } catch {
    return null;
  }
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const role = roleOf(req);
  if (role !== "admin" && role !== "view") {
    return new Response("Unauthorized", { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  const places = Array.isArray(body.places) ? body.places.slice(0, MAX_PLACES) : [];

  const store = getStore("weather");
  const weather = {};

  // Places resolve in parallel — each is a blob read plus (on a cache miss)
  // one or two Open-Meteo calls, so serial lookups added up fast.
  await Promise.all(
    places.map(async (place) => {
      const code = (place.code || "").toUpperCase();
      if (!code) return;

      let cached = null;
      try {
        cached = await store.get(`wx-${code}`, { type: "json" });
      } catch {}
      if (cached) {
        const ttl = cached.data ? WX_TTL_MS : WX_NEG_TTL_MS;
        if (Date.now() - cached.at < ttl) {
          if (cached.data) weather[code] = cached.data;
          return;
        }
      }

      const known = AIRPORT_COORDS[code];
      const coords = known
        ? { lat: known[0], lon: known[1] }
        : await geocode(store, code, place.city);
      const data = coords ? await forecast(coords) : null;
      try {
        await store.setJSON(`wx-${code}`, { at: Date.now(), data });
      } catch {}
      if (data) weather[code] = data;
    }),
  );

  return Response.json({ weather });
};
