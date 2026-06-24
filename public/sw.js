// Färdplan — Service Worker
// Hanterar Web Push-notifikationer

const APP_URL = 'https://Smurf1975.github.io/fardplan-app/';

// ─── Push-event ────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Färdplan', body: event.data.text() };
  }

  const { title, body, icon, badge, tag, data } = payload;

  const options = {
    body: body || '',
    icon: icon || `${APP_URL}favicon.ico`,
    badge: badge || `${APP_URL}favicon.ico`,
    tag: tag || 'fardplan-update',          // ersätter föregående notis med samma tag
    renotify: true,                          // vibrerar även om tag är samma
    requireInteraction: false,               // stängs automatiskt på desktop
    data: data || { url: APP_URL },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(title || 'Färdplan', options)
  );
});

// ─── Notis-klick ──────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || APP_URL;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Finns appen redan öppen? Fokusera den.
      for (const client of windowClients) {
        if (client.url.startsWith(APP_URL) && 'focus' in client) {
          return client.focus();
        }
      }
      // Annars öppna ny flik
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ─── Install & Activate (minimalt — ingen offline-cache) ──────────────────
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
