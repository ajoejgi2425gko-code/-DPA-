const CACHE_NAME = 'dpa-purchase-navi-v9';
const APP_FILES = ['./', './index.html', './app.js', './manifest.json', './icons/icon-192.png', './icons/icon-512.png', './data/dpa-history.json'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('dpa-purchase-navi-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  const request = event.request;
  event.respondWith(fetch(request, {cache: 'no-store'}).then(response => {
    if (response.ok) {
      const copy = response.clone();
      const key = request.mode === 'navigate' ? './index.html' : request;
      caches.open(CACHE_NAME).then(cache => cache.put(key, copy)).catch(() => {});
    }
    return response;
  }).catch(async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await caches.match('./index.html');
      if (shell) return shell;
    }
    return new Response('オフラインです。保存済みデータがないため、このファイルを表示できません。', {
      status: 503, headers: {'Content-Type':'text/plain; charset=utf-8'}
    });
  }));
});
