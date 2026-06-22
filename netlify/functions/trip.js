// One serverless function handling the trip record, code-protected.
// GET    /api/trip  -> current trip; needs a valid code (view or admin)
// POST   /api/trip  -> saves the trip; needs the admin code
// DELETE /api/trip  -> clears it; needs the admin code
//
// The caller sends its code in the "x-access-code" header. We re-check it here
// on every request, because serverless functions keep no session.

import { getStore } from "@netlify/blobs";

const KEY = "current";

function norm(s) {
  return (s || "").replace(/\s+/g, "").toLowerCase();
}

// Mirrors removeAt() in src/App.jsx: the instant a trip should disappear is
// the start of the second calendar day after its last leg lands.
function removeAt(trip) {
  if (!trip || !Array.isArray(trip.legs) || trip.legs.length === 0) return null;
  let last = 0;
  for (const l of trip.legs) {
    const dep = new Date(`${l.date}T${l.depart}:00`);
    let arr = new Date(`${l.date}T${l.arrive}:00`);
    if (arr < dep) arr = new Date(arr.getTime() + 24 * 3600 * 1000);
    if (arr.getTime() > last) last = arr.getTime();
  }
  if (!last) return null;
  const d = new Date(last);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 2);
  return d;
}

function roleOf(req) {
  const c = norm(req.headers.get("x-access-code"));
  if (c && c === norm(process.env.ADMIN_CODE)) return "admin";
  if (c && c === norm(process.env.VIEW_CODE)) return "view";
  return null;
}

export default async (req) => {
  const store = getStore("trips");
  const role = roleOf(req);

  if (req.method === "GET") {
    if (role !== "admin" && role !== "view") {
      return new Response("Unauthorized", { status: 401 });
    }
    const trip = await store.get(KEY, { type: "json" });
    // Self-expire on read so a stale trip doesn't linger just because the
    // only client open when it expired was a "view"-role board (which
    // can't call DELETE).
    const gone = removeAt(trip);
    if (trip && gone && new Date() >= gone) {
      await store.delete(KEY);
      return Response.json({ trip: null });
    }
    return Response.json({ trip: trip || null });
  }

  if (req.method === "POST") {
    if (role !== "admin") {
      return new Response("Forbidden", { status: 403 });
    }
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response("Bad JSON", { status: 400 });
    }
    await store.setJSON(KEY, body.trip);
    return Response.json({ ok: true });
  }

  if (req.method === "DELETE") {
    if (role !== "admin") {
      return new Response("Forbidden", { status: 403 });
    }
    await store.delete(KEY);
    return Response.json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
};
