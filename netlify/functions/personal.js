// Personal touches shared between Beth and Babe-a.
// GET  /api/personal  -> { noteFromBeth, noteFromBabea, special }   (either person)
// POST /api/personal  -> update fields
//     Beth's code    can set { noteFromBeth }    (her note to Babe-a)
//     Babe-a's code  can set { noteFromBabea }   (his note to Beth)
//                    and     { special }         ({ date, label } | null)
//
// Notes live here rather than on the trip record so they survive a trip being
// cleared or republished. When a note actually changes, the other person's
// subscribed devices get a push so the message is seen without opening the app.
//
// Stored as a single small record in Netlify Blobs. The caller sends its code
// in the "x-access-code" header.

import { getStore } from "@netlify/blobs";
import { SUBS_STORE } from "./push.js";
import { fanOut, pushConfigured } from "../lib/push-fanout.js";

const KEY = "personal";
const NOTE_MAX = 280;

function norm(s) {
  return (s || "").replace(/\s+/g, "").toLowerCase();
}

function whoOf(req) {
  const c = norm(req.headers.get("x-access-code"));
  if (c && c === norm(process.env.ADMIN_CODE)) return "babea";
  if (c && c === norm(process.env.VIEW_CODE)) return "beth";
  return null;
}

// Reads the record, folding the pre-identity field name (bethNote) into the
// symmetric shape so nothing Beth already wrote is lost.
async function read(store) {
  let data = null;
  try {
    data = await store.get(KEY, { type: "json" });
  } catch {}
  const d = data && typeof data === "object" ? data : {};
  return {
    noteFromBeth: d.noteFromBeth || d.bethNote || "",
    noteFromBabea: d.noteFromBabea || "",
    special: d.special || null,
  };
}

export default async (req) => {
  const store = getStore("personal");
  const who = whoOf(req);
  if (who !== "babea" && who !== "beth") {
    return new Response("Unauthorized", { status: 401 });
  }

  if (req.method === "GET") {
    return Response.json(await read(store));
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response("Bad JSON", { status: 400 });
    }
    const data = await read(store);
    const before = {
      noteFromBeth: data.noteFromBeth,
      noteFromBabea: data.noteFromBabea,
    };

    // Each person writes their own note, never the other's.
    if (who === "beth" && typeof body.noteFromBeth === "string") {
      data.noteFromBeth = body.noteFromBeth.slice(0, NOTE_MAX);
    }
    if (who === "babea" && typeof body.noteFromBabea === "string") {
      data.noteFromBabea = body.noteFromBabea.slice(0, NOTE_MAX);
    }

    // Only Babe-a sets the special-date countdown.
    if (who === "babea" && "special" in body) {
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

    // A note that actually changed (and isn't a clear) pings the other person.
    if (pushConfigured()) {
      const subs = getStore(SUBS_STORE);
      if (
        who === "beth" &&
        data.noteFromBeth &&
        data.noteFromBeth !== before.noteFromBeth
      ) {
        await fanOut(
          subs,
          {
            title: "💌 A note from Beth",
            body: data.noteFromBeth,
            tag: "note-from-beth",
            url: "/",
          },
          { to: "babea" },
        );
      }
      if (
        who === "babea" &&
        data.noteFromBabea &&
        data.noteFromBabea !== before.noteFromBabea
      ) {
        await fanOut(
          subs,
          {
            title: "💌 A note from Babe-a",
            body: data.noteFromBabea,
            tag: "note-from-babea",
            url: "/",
          },
          { to: "beth" },
        );
      }
    }

    return Response.json({ ok: true, ...data });
  }

  return new Response("Method not allowed", { status: 405 });
};
