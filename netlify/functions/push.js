// Web-push subscription management.
//   GET  /api/push                                  -> { configured, publicKey }
//   POST /api/push  { action:"subscribe", subscription }   store this device
//   POST /api/push  { action:"unsubscribe", endpoint }     forget this device
//
// Needs a valid code (either person) in the "x-access-code" header. Subscriptions
// are kept in Netlify Blobs, keyed by a hash of the endpoint, and tagged with
// who subscribed ("beth" | "babea") so note pushes can target one person. The
// background notifier (functions/notify.js) reads this store to fan flight
// pushes out to every subscribed device.
//
// Push is only "configured" when the VAPID env vars are set
// (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT). When they're missing
// the client hides the toggle, so the feature degrades quietly.

import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

export const SUBS_STORE = "push-subs";

function norm(s) {
  return (s || "").replace(/\s+/g, "").toLowerCase();
}

function whoOf(req) {
  const c = norm(req.headers.get("x-access-code"));
  if (c && c === norm(process.env.ADMIN_CODE)) return "babea";
  if (c && c === norm(process.env.VIEW_CODE)) return "beth";
  return null;
}

// A stable, blob-safe key for a subscription endpoint.
export function endpointKey(endpoint) {
  return createHash("sha256").update(endpoint || "").digest("hex");
}

export default async (req) => {
  const who = whoOf(req);
  if (who !== "babea" && who !== "beth") {
    return new Response("Unauthorized", { status: 401 });
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY || "";
  const configured = !!(
    publicKey &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT
  );

  if (req.method === "GET") {
    return Response.json({ configured, publicKey: configured ? publicKey : "" });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!configured) {
    // Nothing to store against, but don't make the client treat it as an error.
    return Response.json({ ok: true, configured: false });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const store = getStore(SUBS_STORE);

  if (body.action === "subscribe") {
    const sub = body.subscription;
    if (!sub || !sub.endpoint) {
      return new Response("Missing subscription", { status: 400 });
    }
    try {
      await store.setJSON(endpointKey(sub.endpoint), {
        subscription: sub,
        who,
        createdAt: Date.now(),
      });
    } catch (e) {
      return new Response("Save failed", { status: 500 });
    }
    return Response.json({ ok: true });
  }

  if (body.action === "unsubscribe") {
    const endpoint = body.endpoint || (body.subscription && body.subscription.endpoint);
    if (!endpoint) return new Response("Missing endpoint", { status: 400 });
    try {
      await store.delete(endpointKey(endpoint));
    } catch {}
    return Response.json({ ok: true });
  }

  return new Response("Unknown action", { status: 400 });
};
