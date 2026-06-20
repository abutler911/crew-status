// All talk to the server lives here. After the gate authenticates, we keep the
// typed code in memory and attach it to every request as a header. The server
// re-checks it on each call, since serverless functions have no sessions.

let accessCode = null;

function authHeaders(extra) {
  return { ...(extra || {}), "x-access-code": accessCode || "" };
}

// Sends the typed code to the server, which says whether it's "admin", "view",
// or invalid. On success we remember the code for later requests.
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
      return data.role;
    }
    return null;
  } catch {
    return null;
  }
}

export function signOut() {
  accessCode = null;
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
