self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "notify") {
    self.registration.showNotification("AI Update Intel", {
      body: event.data.count + "件の新しい緊急アラートがあります。",
      tag: "ai-update-intel-alert"
    });
  }
});
