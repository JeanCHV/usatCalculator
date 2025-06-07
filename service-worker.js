const CACHE_NAME = 'usat-calc-v2'; // Cambia la versión cuando actualices
const OFFLINE_URL = '/offline.html'; // Opcional: página para modo offline

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/offline.html',
        'assets/img/usat_logo.png',
        'assets/img/usat_logo_red.jpg',
        'css/style.css',
        'js/app.js',
        'js/utils.js',
        'js/db.js',
        'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
        'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
        'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',

        // Añade otros recursos importantes
      ]);
    })
  );
  // Fuerza al SW a activarse inmediatamente
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName); // Elimina caches antiguos
          }
        })
      );
    })
  );
  // Toma el control de todos los clients
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Ignora solicitudes que no sean GET
  if (event.request.method !== 'GET') return;
  
  // Estrategia: Cache primero, luego red
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Siempre intenta actualizar el cache en segundo plano
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Clona la respuesta porque solo se puede consumir una vez
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Si falla la red y no hay cache, muestra página offline
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
        return cachedResponse;
      });
      
      // Devuelve la respuesta cacheada si existe, o la de red
      return cachedResponse || fetchPromise;
    })
  );
});

// Escucha mensajes para actualizar la app
self.addEventListener('message', (event) => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});