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
const WX_TTL_MS = 30 * 60 * 1000; // refresh conditions every 30 min
const GEO_TTL_MS = 180 * 24 * 3600 * 1000; // coordinates: basically forever
const MAX_PLACES = 12;

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
    if (cached && Date.now() - cached.at < GEO_TTL_MS) return cached.coords;
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

  for (const place of places) {
    const code = (place.code || "").toUpperCase();
    if (!code) continue;

    let cached = null;
    try {
      cached = await store.get(`wx-${code}`, { type: "json" });
    } catch {}
    if (cached && Date.now() - cached.at < WX_TTL_MS) {
      if (cached.data) weather[code] = cached.data;
      continue;
    }

    const coords = await geocode(store, code, place.city);
    const data = coords ? await forecast(coords) : null;
    try {
      await store.setJSON(`wx-${code}`, { at: Date.now(), data });
    } catch {}
    if (data) weather[code] = data;
  }

  return Response.json({ weather });
};
