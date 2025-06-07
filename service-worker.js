self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('usat-calc-v1').then(cache => {
      return cache.addAll([
        '/',
        'assets/img/usat_logo.png',
        'assets/img/usat_logo_red.jpg',
      ]);
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
