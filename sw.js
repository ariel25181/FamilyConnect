// Service Worker — se registra a nivel del sistema, sigue vivo aunque la app esté cerrada.
// Esto es lo que permite recibir el push incluso con Chrome minimizado o la app cerrada.

const FIREBASE_DB_URL = 'https://familyconnect-b1c23-default-rtdb.firebaseio.com';
const VAPID_PUBLIC_KEY = 'BJlDGXObXkSHhVl8cZmjEIr1CvfAghWlUNDmOac_gOpiW6lAd4rFYtdKqWnic9HHXDa_bC_D58NZoF2u8x44_9Y';

async function kvGet(key) {
  const cache = await caches.open('familia-kv');
  const res = await cache.match(key);
  return res ? res.text() : null;
}
async function kvSet(key, value) {
  const cache = await caches.open('familia-kv');
  await cache.put(key, new Response(String(value)));
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_MEMBER_ID') {
    event.waitUntil(kvSet('memberId', event.data.memberId));
  }
});

self.addEventListener('push', (event) => {
  let data = { title: 'Familia', body: 'Tenes un mensaje nuevo' };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {}

  const options = {
    body: data.body,
    icon: data.icon || undefined,
    badge: data.badge || undefined,
    tag: 'familia-chat',
    renotify: true,
    data: { url: data.url || './' }
  };

  event.waitUntil((async () => {
    await self.registration.showNotification(data.title, options);
    if ('setAppBadge' in self.navigator) {
      const current = parseInt((await kvGet('badgeCount')) || '0', 10);
      const next = current + 1;
      await kvSet('badgeCount', next);
      try { await self.navigator.setAppBadge(next); } catch (e) {}
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './';

  event.waitUntil((async () => {
    if ('clearAppBadge' in self.navigator) {
      await kvSet('badgeCount', 0);
      try { await self.navigator.clearAppBadge(); } catch (e) {}
    }
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) {
      if ('focus' in client) return client.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
  })());
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    try {
      const memberId = await kvGet('memberId');
      if (!memberId) return;

      const newSub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      await fetch(FIREBASE_DB_URL + '/subscriptions/' + memberId + '.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSub.toJSON())
      });
    } catch (e) {}
  })());
});
