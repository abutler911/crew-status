// Personal touches shared between Beth and Babe-a.
// GET  /api/personal  -> { bethNote, special }   (view or admin)
// POST /api/personal  -> update fields
//     view code  can set { bethNote }            (a note from Beth)
//     admin code can set { bethNote, special }   (special = { date, label } | null)
//
// Stored as a single small record in Netlify Blobs. The caller sends its code
// in the "x-access-code" header.

import { getStore } from "@netlify/blobs";

const KEY = "personal";

function norm(s) {
  return (s || "").replace(/\s+/g, "").toLowerCase();
}

function roleOf(req) {
  const c = norm(req.headers.get("x-access-code"));
  if (c && c === norm(process.env.ADMIN_CODE)) return "admin";
  if (c && c === norm(process.env.VIEW_CODE)) return "view";
  return null;
}

async function read(store) {
  let data = null;
  try {
    data = await store.get(KEY, { type: "json" });
  } catch {}
  return data && typeof data === "object" ? data : { bethNote: "", special: null };
}

export default async (req) => {
  const store = getStore("personal");
  const role = roleOf(req);
  if (role !== "admin" && role !== "view") {
    return new Response("Unauthorized", { status: 401 });
  }

  if (req.method === "GET") {
    const data = await read(store);
    return Response.json({
      bethNote: data.bethNote || "",
      special: data.special || null,
    });
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response("Bad JSON", { status: 400 });
    }
    const data = await read(store);

    // Beth (view) can leave a note. Admin can do that too.
    if (typeof body.bethNote === "string") {
      data.bethNote = body.bethNote.slice(0, 280);
    }

    // Only admin sets the special-date countdown.
    if (role === "admin" && "special" in body) {
      const sp = body.special;
      data.special =
        sp && sp.date
          ? { date: String(sp.date), label: String(sp.label || "").slice(0, 60) }
          : null;
    }

    try {
      await store.setJSON(KEY, data);
    } catch (e) {
      return new Response("Save failed", { status: 500 });
    }
    return Response.json({ ok: true, ...data });
  }

  return new Response("Method not allowed", { status: 405 });
};
