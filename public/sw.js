self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open('joonkawa-pwa-v1').then(function(cache) {
      return cache.addAll([
        '/',
        '/index.html',
        '/style.css',
        '/app.js',
        '/manifest.json',
        '/icon-192.png',
        '/icon-512.png'
        // add other assets as needed
      ]);
    })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request).then(function(response) {
      return response || fetch(event.request);
    })
  );
});
