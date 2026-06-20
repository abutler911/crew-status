// One serverless function handling the single trip record, now code-protected.
// GET    /api/trip  -> returns the current trip; needs a valid code (view or admin)
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
