// Shared web-push fan-out. Sends one payload to subscribed devices, optionally
// only the devices belonging to one person, pruning subscriptions the push
// service reports as gone (404 / 410).

import webpush from "web-push";

export function pushConfigured() {
  return !!(
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT
  );
}

// Which person a stored subscription belongs to. New records carry `who`
// ("beth" | "babea"); records saved before the identity change carry the old
// `role` tag instead, so map those across rather than dropping them.
function personOf(rec) {
  if (rec.who === "beth" || rec.who === "babea") return rec.who;
  if (rec.role === "admin") return "babea";
  if (rec.role === "view") return "beth";
  return null;
}

// Send `payload` to every subscription in `subsStore`. Pass { to: "beth" } or
// { to: "babea" } to reach just that person's devices; omit it to reach all.
export async function fanOut(subsStore, payload, opts = {}) {
  if (!pushConfigured()) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );

  let list;
  try {
    list = await subsStore.list();
  } catch {
    return;
  }
  const body = JSON.stringify(payload);
  for (const { key } of list.blobs || []) {
    let rec;
    try {
      rec = await subsStore.get(key, { type: "json" });
    } catch {
      continue;
    }
    if (!rec || !rec.subscription) continue;
    if (opts.to && personOf(rec) !== opts.to) continue;
    try {
      await webpush.sendNotification(rec.subscription, body);
    } catch (e) {
      const code = e && e.statusCode;
      if (code === 404 || code === 410) {
        try {
          await subsStore.delete(key);
        } catch {}
      }
    }
  }
}
