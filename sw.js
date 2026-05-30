// ══════════════════════════════════════════
//  Family Chat — Service Worker
//  Handles: PWA install, offline cache,
//           notification clicks, background sync
// ══════════════════════════════════════════
const CACHE_NAME = 'fc-v2';
const SHELL = ['./'];

// ── Install: cache the app shell ───────────
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(SHELL))
  );
});

// ── Activate: clean old caches ─────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: serve from cache, fallback to net ──
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      if (res && res.status === 200 && e.request.url.startsWith(self.location.origin)) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      }
      return res;
    }))
  );
});

// ── Notification click: focus or open app ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow('./');
    })
  );
});

// ── Push event (optional Web Push support) ──
self.addEventListener('push', e => {
  if (!e.data) return;
  let payload;
  try { payload = e.data.json(); } catch { payload = { title: '💬 New message', body: e.data.text() }; }
  e.waitUntil(
    self.registration.showNotification(payload.title || '💬 Family Chat', {
      body: payload.body || '',
      icon: payload.icon || './icon-192.png',
      badge: './icon-96.png',
      tag: 'fc-msg',
      renotify: true,
      vibrate: [150, 80, 150]
    })
  );
});
