const CACHE_NAME = 'graceai-v7';
const PRECACHE = [
  '/',
  '/chat.html',
  '/devotional.html',
  '/community.html',
  '/css/base.css',
  '/css/design-tokens.css',
  '/css/landing.css',
  '/css/chat.css',
  '/css/devotional.css',
  '/css/community.css',
  '/css/pages.css',
  '/css/study.css',
  '/js/api.js',
  '/js/chat.js',
  '/js/study-builder.js',
  '/js/community.js',
  '/js/supabase.js',
  '/js/auth-ui.js',
  '/css/auth.css',
  '/img/favicon.svg',
  '/img/icon-192.svg',
  '/img/icon-512.svg',
  '/manifest.json'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) { return name !== CACHE_NAME; })
             .map(function(name) { return caches.delete(name); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  // Network-first for API calls
  if (event.request.url.includes('/.netlify/functions/')) return;

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        if (response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    }).catch(function() {
      if (event.request.destination === 'document') {
        return caches.match('/');
      }
    })
  );
});
