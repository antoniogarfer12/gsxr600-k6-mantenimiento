// Service worker: permite usar la app sin conexión y avisa de los mantenimientos
importScripts('js/store.js');

const CACHE = 'gsxr-garage-v4';
const ASSETS = [
  './',
  'index.html',
  'css/styles.css',
  'js/bikes/common.js',
  'js/bikes/gsxr600k6.js',
  'js/bikes/drz400.js',
  'js/bikes/superduke1290r.js',
  'js/bikes/superadventure1290s.js',
  'js/bikes/exc250.js',
  'js/store.js',
  'js/app.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Red primero (para recibir actualizaciones) y caché si no hay conexión
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html')))
  );
});

// Comprobación periódica en segundo plano (Chrome/Android con la app instalada)
self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'gsxr-reminders') e.waitUntil(checkReminders());
});

async function checkReminders() {
  const due = await takeDueReminders();
  for (const m of reminderMessages(due)) {
    await self.registration.showNotification(m.title, { ...NOTIFICATION_DEFAULTS, body: m.body, tag: m.tag });
  }
}

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => (list.length ? list[0].focus() : self.clients.openWindow('./')))
  );
});
