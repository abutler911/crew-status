// One serverless function handling the trip record, now code-protected, plus a
// rolling history of past trips.
// GET    /api/trip            -> current trip; needs a valid code (view or admin)
// GET    /api/trip?history=1  -> archived past trips (newest first)
// POST   /api/trip            -> saves the trip; needs the admin code
// DELETE /api/trip            -> clears it; needs the admin code
//
// When a trip is replaced or cleared, it's archived into history (most recent
// ~30) so Beth can look back at where Babe-a has been.
//
// The caller sends its code in the "x-access-code" header. We re-check it here
// on every request, because serverless functions keep no session.

import { getStore } from "@netlify/blobs";

const KEY = "current";
const HISTORY_KEY = "history";
const MAX_HISTORY = 30;

function norm(s) {
  return (s || "").replace(/\s+/g, "").toLowerCase();
}

function roleOf(req) {
  const c = norm(req.headers.get("x-access-code"));
  if (c && c === norm(process.env.ADMIN_CODE)) return "admin";
  if (c && c === norm(process.env.VIEW_CODE)) return "view";
  return null;
}

// A stable fingerprint of a trip's legs, so we don't archive the same trip
// twice (e.g. a clear right after an expiry).
function signature(trip) {
  if (!trip || !Array.isArray(trip.legs)) return "";
  return trip.legs
    .map((l) => `${l.date}|${l.flight}|${l.from}|${l.to}`)
    .join("~");
}

async function archive(store, trip) {
  if (!trip || !Array.isArray(trip.legs) || trip.legs.length === 0) return;
  let history = [];
  try {
    history = (await store.get(HISTORY_KEY, { type: "json" })) || [];
  } catch {}
  if (!Array.isArray(history)) history = [];
  const sig = signature(trip);
  if (history.some((t) => signature(t) === sig)) return; // already archived
  history.push({
    legs: trip.legs,
    note: trip.note || "",
    updatedAt: trip.updatedAt || null,
    archivedAt: new Date().toISOString(),
  });
  if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
  try {
    await store.setJSON(HISTORY_KEY, history);
  } catch {}
}

export default async (req) => {
  const store = getStore("trips");
  const role = roleOf(req);

  if (req.method === "GET") {
    if (role !== "admin" && role !== "view") {
      return new Response("Unauthorized", { status: 401 });
    }
    const url = new URL(req.url);
    if (url.searchParams.get("history") === "1") {
      let history = [];
      try {
        history = (await store.get(HISTORY_KEY, { type: "json" })) || [];
      } catch {}
      if (!Array.isArray(history)) history = [];
      // Newest first.
      return Response.json({ history: [...history].reverse() });
    }
    const trip = await store.get(KEY, { type: "json" });
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
    // If a different trip is already current, archive it before replacing.
    const existing = await store.get(KEY, { type: "json" });
    if (existing && signature(existing) !== signature(body.trip)) {
      await archive(store, existing);
    }
    await store.setJSON(KEY, body.trip);
    return Response.json({ ok: true });
  }

  if (req.method === "DELETE") {
    if (role !== "admin") {
      return new Response("Forbidden", { status: 403 });
    }
    const existing = await store.get(KEY, { type: "json" });
    if (existing) await archive(store, existing);
    await store.delete(KEY);
    return Response.json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
};
