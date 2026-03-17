self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : {};

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Jinka EG", {
      body: payload.body ?? "",
      data: {
        clusterId: payload.clusterId ?? null
      }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const clusterId = event.notification.data?.clusterId;
  const targetUrl = clusterId ? `/en/listing/${clusterId}` : "/en/inbox";

  event.waitUntil(clients.openWindow(targetUrl));
});
