const CACHE_NAME = 'graceai-v11';
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

function networkFirst(request) {
  return fetch(request).then(function(response) {
    if (response && response.status === 200) {
      var clone = response.clone();
      caches.open(CACHE_NAME).then(function(cache) { cache.put(request, clone); });
    }
    return response;
  }).catch(function() {
    return caches.match(request).then(function(cached) {
      if (cached) return cached;
      if (request.mode === 'navigate') return caches.match('/');
      return undefined;
    });
  });
}

function cacheFirst(request) {
  return caches.match(request).then(function(cached) {
    if (cached) return cached;
    return fetch(request).then(function(response) {
      if (response.status === 200) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) { cache.put(request, clone); });
      }
      return response;
    });
  }).catch(function() {
    if (request.destination === 'document') return caches.match('/');
  });
}

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  var url = new URL(event.request.url);

  // Bypass the service worker entirely for API calls
  if (url.pathname.indexOf('/.netlify/functions/') !== -1) return;
  if (url.hostname.indexOf('supabase.co') !== -1) return;

  var isSameOrigin = url.origin === self.location.origin;
  var isDocOrCode =
    event.request.mode === 'navigate' ||
    event.request.destination === 'document' ||
    event.request.destination === 'script' ||
    event.request.destination === 'style';

  // Network-first for our own HTML/JS/CSS so code updates always reach the
  // client (prevents iOS/PWA from getting stuck on stale cached pages).
  if (isSameOrigin && isDocOrCode) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Cache-first for everything else (images, fonts, CDN libraries)
  event.respondWith(cacheFirst(event.request));
});
