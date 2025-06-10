const CACHE_NAME = 'usat-calc-v2';
const OFFLINE_URL = '/offline.html';
const PRECACHE_URLS = [
  '/',
  'assets/img/usat_logo.png',
  'assets/img/usat_logo_red.jpg',
  '/offline.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Cachear recursos uno por uno para manejar errores individualmente
        return Promise.all(
          PRECACHE_URLS.map((url) => {
            return fetch(url, { cache: 'no-cache' })
              .then((response) => {
                if (response.ok) {
                  return cache.put(url, response);
                }
                console.log('No se pudo cachear:', url);
              })
              .catch((err) => {
                console.log('Error al cachear', url, err);
              });
          })
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  // Manejo especial para navegación offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Devuelve la respuesta cacheada si existe
        if (cachedResponse) {
          return cachedResponse;
        }

        // Sino, intenta obtenerla de la red
        return fetch(event.request)
          .then((response) => {
            // Clona la respuesta para cachearla
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(event.request, responseToCache));
            return response;
          })
          .catch(() => {
            // Si es una imagen, devuelve un placeholder
            if (event.request.headers.get('Accept').includes('image')) {
              return caches.match('assets/img/usat_logo.png');
            }
          });
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});