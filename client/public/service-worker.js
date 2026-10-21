self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data?.text() ?? "A customer follow-up is due." }; }
  const title = payload.title || "FieldDesk follow-up reminder";
  const options = {
    body: payload.body || "You have customer follow-ups to review.",
    icon: payload.icon || "/favicon.ico",
    badge: payload.badge || "/favicon.ico",
    tag: payload.tag || "fielddesk-follow-up",
    data: { url: payload.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
    const existing = clients.find(client => "focus" in client && client.url.startsWith(self.location.origin));
    return existing ? existing.focus() : self.clients.openWindow(target);
  }));
});
