self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('usat-calc-v1').then(cache => {
      return cache.addAll([
        '/',
        'index.html',
        'css/style.css',
        'js/app.js',
        'js/utils.js',
        'js/db.js',
        'assets/img/usat_logo.png',
        'assets/img/usat_logo_red.jpg',
        'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
        'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
        'https://code.jquery.com/jquery-3.7.1.min.js',
        'https://cdn.jsdelivr.net/npm/sweetalert2@11',
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.min.js',
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
