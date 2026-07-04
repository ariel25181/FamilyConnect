// Service Worker — se registra a nivel del sistema, sigue vivo aunque la app esté cerrada.
// Esto es lo que permite recibir el push incluso con Chrome minimizado o la app cerrada.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Llega el push desde el servidor (Netlify function) -> mostramos la notificación del sistema
self.addEventListener('push', (event) => {
  let data = { title: 'Familia', body: 'Tenés un mensaje nuevo' };
  try {
    if (event.data) data = event.data.json();
  } catch (e) { /* fallback al mensaje genérico */ }

  const options = {
    body: data.body,
    icon: data.icon || undefined,
    badge: data.badge || undefined,
    tag: 'familia-chat', // agrupa notificaciones sucesivas en una sola
    renotify: true,
    data: { url: data.url || './' }
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Si tocan la notificación, abrimos (o enfocamos) la app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
