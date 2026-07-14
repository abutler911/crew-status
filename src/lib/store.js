// All talk to the server lives here. After the gate authenticates, we keep the
// typed code both in memory and saved on the device, so a refresh (or reopening
// the installed app) stays signed in. "Lock" clears it.

let accessCode = null;
const CODE_KEY = "cs-access-code";

function authHeaders(extra) {
  return { ...(extra || {}), "x-access-code": accessCode || "" };
}

// Sends the typed code to the server, which says who it belongs to. On success
// we remember the code, in memory and on the device, and return the identity:
// { who: "babea" | "beth", canPublish }. Returns null for a bad code.
export async function authenticate(code) {
  try {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.who === "babea" || data.who === "beth") {
      accessCode = code;
      try {
        localStorage.setItem(CODE_KEY, code);
      } catch {}
      return { who: data.who, canPublish: !!data.canPublish };
    }
    return null;
  } catch {
    return null;
  }
}

// On app load: if a code was saved on this device, re-check it with the server
// and return the identity, so we can skip the gate. Returns null if nothing
// saved or the saved code is no longer valid.
export async function resume() {
  let saved = null;
  try {
    saved = localStorage.getItem(CODE_KEY);
  } catch {}
  if (!saved) return null;
  const me = await authenticate(saved);
  if (!me) {
    try {
      localStorage.removeItem(CODE_KEY);
    } catch {}
  }
  return me;
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

// Personal record: each direction's latest note ({ noteFromBeth,
// noteFromBethAt, noteFromBethSeenAt }, likewise for Babe-a), short note
// histories (notesFromBeth / notesFromBabea, newest first), and the shared
// special date. Returns defaults on failure.
const PERSONAL_DEFAULTS = {
  noteFromBeth: "",
  noteFromBethAt: null,
  noteFromBethSeenAt: null,
  noteFromBabea: "",
  noteFromBabeaAt: null,
  noteFromBabeaSeenAt: null,
  notesFromBeth: [],
  notesFromBabea: [],
  special: null,
};
export async function getPersonal() {
  try {
    const res = await fetch("/api/personal", { headers: authHeaders() });
    if (!res.ok) return { ...PERSONAL_DEFAULTS };
    return await res.json();
  } catch {
    return { ...PERSONAL_DEFAULTS };
  }
}

// Tell the server this person's board just displayed the other person's
// note, so their composer can show a little "seen" mark. `from` is whose
// note was read ("beth" or "babea"). Quiet failure — it's a nicety.
export async function markNoteSeen(from) {
  try {
    await savePersonal({ sawNoteFrom: from });
  } catch {}
}

// Save personal fields. Beth may set noteFromBeth; Babe-a may set
// noteFromBabea and special ({ date, label } or null). Either may send
// sawNoteFrom (see markNoteSeen).
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

// Whether the server has web-push configured, and the VAPID public key the
// browser needs to subscribe. Returns { configured:false } on any failure.
export async function pushConfig() {
  try {
    const res = await fetch("/api/push", { headers: authHeaders() });
    if (!res.ok) return { configured: false, publicKey: "" };
    return await res.json();
  } catch {
    return { configured: false, publicKey: "" };
  }
}

// Register this device's push subscription with the server.
export async function pushSubscribe(subscription) {
  const res = await fetch("/api/push", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ action: "subscribe", subscription }),
  });
  if (!res.ok) throw new Error("subscribe failed (" + res.status + ")");
  return res.json();
}

// Forget this device's push subscription on the server.
export async function pushUnsubscribe(endpoint) {
  try {
    await fetch("/api/push", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ action: "unsubscribe", endpoint }),
    });
  } catch {}
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
