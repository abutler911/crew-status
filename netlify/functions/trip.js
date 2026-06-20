// One serverless function handling the single trip record.
// GET    /api/trip  -> returns the current trip (or null)
// POST   /api/trip  -> saves the trip (body: { trip })
// DELETE /api/trip  -> clears it
//
// Storage is Netlify Blobs: a key-value store built into your site. We keep one
// store named "trips" and one key, "current". No database to set up.
//
// Note: there is no access-code check in here yet. We add that in step 6.

import { getStore } from "@netlify/blobs";

const KEY = "current";

export default async (req) => {
  const store = getStore("trips");

  if (req.method === "GET") {
    const trip = await store.get(KEY, { type: "json" });
    return Response.json({ trip: trip || null });
  }

  if (req.method === "POST") {
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
    await store.delete(KEY);
    return Response.json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
};
