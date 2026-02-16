// LENTANDO - Progress At Your Pace
// Copyright (c) 2026 Frank Force

// Service Worker for Lentando PWA
const SW_DEBUG = false; // Set to true to enable console logging
const CACHE_NAME = 'lentando-v337'; // Update this to force cache refresh
const urlsToCache = [
  './index.html',
  './code.js',
  './zzfx.js',
  './firebase-sync.js',
  './manifest.json',
  './favicon.png',
  './icon-192.png',
  './icon-512.png',
  './privacy.html',
  './terms.html'
];

// Install service worker and cache core files (bypass HTTP cache)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        if (SW_DEBUG) console.log('[SW] Caching app shell');
        // Fetch with cache: 'reload' to bypass HTTP cache
        return Promise.all(
          urlsToCache.map(url => 
            fetch(url, { cache: 'reload' })
              .then(response => {
                if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
                return cache.put(url, response);
              })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Activate service worker and clean up old caches
self.addEventListener('activate', event => {
  if (SW_DEBUG) console.log('[SW]', CACHE_NAME);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            if (SW_DEBUG) console.log('[SW] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch strategy: Network first, falling back to cache (same-origin only)
self.addEventListener('fetch', event => {
  // Only cache GET requests — non-GET requests pass through to network
  if (event.request.method !== 'GET') return;

  // Don't intercept cross-origin requests (Firebase SDK, Firestore API, CDNs, etc.)
  // Let them go directly to network without SW interference
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (!response || response.status !== 200) {
          return caches.match(event.request).then(cached => cached || response);
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;

        // For SPA navigations, fall back to cached app shell when available
        if (event.request.mode === 'navigate') {
          const appShell = await caches.match('./index.html');
          if (appShell) return appShell;
        }

        return new Response('Offline. Please reconnect and try again.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })
  );
});

// Handle reminder notification from main thread
self.addEventListener('message', event => {
  if (event.data?.type === 'SHOW_REMINDER') {
    self.registration.showNotification(event.data.title, {
      body: event.data.body,
      icon: event.data.icon,
      tag: 'daily-reminder',
      renotify: true
    });
  }
});

// Open app when notification is clicked
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Focus existing window if one is open
      for (const client of windowClients) {
        if (client.url.includes('index.html') || client.url.endsWith('/')) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      return clients.openWindow('./');
    })
  );
});
