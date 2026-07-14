// Service worker for Where in the world is Babe-a? — push notifications only.
//
// It deliberately does NOT cache the app: keeping it cache-free means the PWA
// always loads the latest deploy and we never have to ship cache-busting logic.
// Its whole job is to receive a push and show it, then focus the app on tap.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Where in the world is Babe-a?", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Where in the world is Babe-a?";
  const options = {
    body: data.body || "",
    tag: data.tag || undefined,
    // renotify only matters when a tag is reused; harmless otherwise.
    renotify: !!data.tag,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
        return undefined;
      })
  );
});
