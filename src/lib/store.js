// All talk to the server lives here. After the gate authenticates, we keep the
// typed code both in memory and saved on the device, so a refresh (or reopening
// the installed app) stays signed in. "Lock" clears it.

let accessCode = null;
const CODE_KEY = "cs-access-code";

function authHeaders(extra) {
  return { ...(extra || {}), "x-access-code": accessCode || "" };
}

// Sends the typed code to the server, which says whether it's "admin", "view",
// or invalid. On success we remember the code, in memory and on the device.
export async function authenticate(code) {
  try {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.role === "admin" || data.role === "view") {
      accessCode = code;
      try {
        localStorage.setItem(CODE_KEY, code);
      } catch {}
      return data.role;
    }
    return null;
  } catch {
    return null;
  }
}

// On app load: if a code was saved on this device, re-check it with the server
// and return the role, so we can skip the gate. Returns null if nothing saved
// or the saved code is no longer valid.
export async function resume() {
  let saved = null;
  try {
    saved = localStorage.getItem(CODE_KEY);
  } catch {}
  if (!saved) return null;
  const role = await authenticate(saved);
  if (!role) {
    try {
      localStorage.removeItem(CODE_KEY);
    } catch {}
  }
  return role;
}

export function signOut() {
  accessCode = null;
  try {
    localStorage.removeItem(CODE_KEY);
  } catch {}
}

export async function getTrip() {
  try {
    const res = await fetch("/api/trip", { headers: authHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    return data.trip || null;
  } catch {
    return null;
  }
}

export async function saveTrip(trip) {
  const res = await fetch("/api/trip", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ trip }),
  });
  if (!res.ok) throw new Error("save failed (" + res.status + ")");
}

export async function clearTrip() {
  await fetch("/api/trip", { method: "DELETE", headers: authHeaders() });
}

// Personal record: { bethNote, special }. Returns defaults on failure.
export async function getPersonal() {
  try {
    const res = await fetch("/api/personal", { headers: authHeaders() });
    if (!res.ok) return { bethNote: "", special: null };
    return await res.json();
  } catch {
    return { bethNote: "", special: null };
  }
}

// Save personal fields. Beth (view) may set bethNote; admin may also set
// special ({ date, label } or null).
export async function savePersonal(fields) {
  const res = await fetch("/api/personal", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error("save failed (" + res.status + ")");
  return res.json();
}

export async function parse(raw) {
  const res = await fetch("/api/parse", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) throw new Error("parse request failed (" + res.status + ")");
  const data = await res.json();
  return data.legs;
}

// Live status for the given legs, keyed by "<flight>|<date>". Returns {} on any
// failure (or when the server has no AeroAPI key), so the board simply falls
// back to the printed schedule.
export async function flightStatus(legs) {
  try {
    const res = await fetch("/api/flightstatus", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ legs }),
    });
    if (!res.ok) return {};
    const data = await res.json();
    return data.statuses || {};
  } catch {
    return {};
  }
}

// Current weather for the given destinations, keyed by airport code. Returns {}
// on any failure, so the board just shows no weather.
export async function weather(places) {
  try {
    const res = await fetch("/api/weather", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ places }),
    });
    if (!res.ok) return {};
    const data = await res.json();
    return data.weather || {};
  } catch {
    return {};
  }
}
