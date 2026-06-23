// Browser-side push plumbing: service-worker registration and turning a
// PushManager subscription on or off. The server side (talking to our API with
// the access code) lives in store.js; this file only touches browser APIs.

// VAPID public keys are base64url; PushManager wants a Uint8Array.
function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Push needs a service worker, the Push API, and the Notification API. iOS only
// exposes these when the app is launched from the Home Screen (installed PWA).
export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function permission() {
  return pushSupported() ? Notification.permission : "denied";
}

// Registers the service worker (idempotent) and resolves once it's ready.
export async function ensureServiceWorker() {
  if (!pushSupported()) return null;
  try {
    await navigator.serviceWorker.register("/sw.js");
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

// The current push subscription for this device, or null.
export async function currentSubscription() {
  if (!pushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

// Asks permission (if needed) and subscribes. Returns the subscription, or
// throws with a friendly message the caller can surface.
export async function subscribe(publicKey) {
  if (!pushSupported()) throw new Error("unsupported");
  const reg = await ensureServiceWorker();
  if (!reg) throw new Error("no-sw");

  let perm = Notification.permission;
  if (perm === "default") perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("denied");

  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;

  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
}

// Unsubscribes this device. Returns the endpoint we removed (so the caller can
// tell the server to forget it), or null if there was nothing to remove.
export async function unsubscribe() {
  const sub = await currentSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  try {
    await sub.unsubscribe();
  } catch {}
  return endpoint;
}
