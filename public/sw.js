const CACHE_VERSION = 'v2';
const STATIC_CACHE = `parkingpro-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `parkingpro-dynamic-${CACHE_VERSION}`;
const API_CACHE = `parkingpro-api-${CACHE_VERSION}`;

const STATIC_ASSETS = ['/', '/index.html', '/manifest.json', '/favicon.svg', '/offline.html'];

// Stale-while-revalidate max age for API responses (30 seconds)
const API_CACHE_MAX_AGE = 30 * 1000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS.filter(a => a !== '/offline.html')))
      .catch(() => {}) // Don't fail install if some assets are missing
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const validCaches = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !validCaches.includes(k)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Background sync registration
self.addEventListener('sync', (event) => {
  if (event.tag === 'offline-queue-sync') {
    event.waitUntil(syncOfflineQueue());
  }
});

async function syncOfflineQueue() {
  // Notify all clients to trigger their sync
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_OFFLINE_QUEUE' });
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests for caching (but let them pass through)
  if (request.method !== 'GET') {
    event.respondWith(
      fetch(request).catch(() => new Response(JSON.stringify({ error: 'Sin conexión al servidor' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  // API requests: stale-while-revalidate strategy
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/rpc/')) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
    return;
  }

  // Static assets: cache-first
  if (STATIC_ASSETS.includes(url.pathname) || url.pathname.match(/\.(js|css|woff2?|png|svg|ico)$/)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Navigation requests: network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // Default: network-first then dynamic cache
  event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

// Cache-first strategy
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Asset not available offline', { status: 503 });
  }
}

// Network-first strategy
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Not available offline', { status: 503 });
  }
}

// Stale-while-revalidate strategy for API calls
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      // Add timestamp header for cache age tracking
      const headers = new Headers(response.headers);
      headers.set('sw-cache-timestamp', Date.now().toString());
      const clonedResponse = new Response(response.clone().body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
      cache.put(request, clonedResponse);
    }
    return response;
  }).catch(() => null);

  if (cached) {
    // Check if cached response is stale
    const cacheTimestamp = parseInt(cached.headers.get('sw-cache-timestamp') || '0');
    const isStale = (Date.now() - cacheTimestamp) > API_CACHE_MAX_AGE;

    if (!isStale) {
      return cached;
    }

    // Return stale response while revalidating in background
    fetchPromise.catch(() => {});
    return cached;
  }

  // No cache: wait for network
  const response = await fetchPromise;
  if (response) return response;

  return new Response(JSON.stringify({ error: 'Sin conexión al servidor', offline: true }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Network-first with offline page fallback for navigation
async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Try to return the main app shell
    const appShell = await caches.match('/index.html');
    if (appShell) return appShell;
    return new Response('<html><body><h1>Sin conexión</h1><p>La aplicación no está disponible sin internet en este momento.</p></body></html>', {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
