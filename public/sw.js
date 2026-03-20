/**
 * ParkingPro Service Worker — Production Grade, Offline-First
 * Version: 3.0.0
 *
 * Strategies:
 *  - Stale-While-Revalidate : read-heavy API endpoints (reports, active sessions)
 *  - Network-First + Queue  : write/mutation endpoints (entry, exit, payments)
 *  - Cache-First            : static assets (JS, CSS, images, fonts)
 *  - Network-First + Fallback: navigation requests → offline.html
 *  - Network-First + Timeout: all other API calls (10 s timeout, cache fallback)
 */

// ---------------------------------------------------------------------------
// Cache names
// ---------------------------------------------------------------------------
const CACHE_VERSION = 'v3';
const STATIC_CACHE  = `parkingpro-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `parkingpro-dynamic-${CACHE_VERSION}`;
const API_CACHE     = `parkingpro-api-${CACHE_VERSION}`;

const ALL_CACHES = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE];

// ---------------------------------------------------------------------------
// Cache size limits
// ---------------------------------------------------------------------------
const DYNAMIC_CACHE_MAX = 50;
const API_CACHE_MAX     = 100;

// ---------------------------------------------------------------------------
// App-shell files to precache on install
// ---------------------------------------------------------------------------
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/favicon.svg',
];

// ---------------------------------------------------------------------------
// Route matchers
// ---------------------------------------------------------------------------
const STALE_WHILE_REVALIDATE_ROUTES = [
  /^\/api\/v1\/reports\//,
  /^\/api\/v1\/access\/sessions\/active/,
];

const NETWORK_FIRST_QUEUE_ROUTES = [
  /^\/api\/v1\/access\/entry/,
  /^\/api\/v1\/access\/exit/,
  /^\/api\/v1\/payments/,
];

const STATIC_ASSET_PATTERN = /\.(js|css|woff2?|ttf|otf|eot|png|jpg|jpeg|gif|svg|ico|webp|avif)(\?.*)?$/i;

// ---------------------------------------------------------------------------
// IndexedDB helpers for the offline queue
// ---------------------------------------------------------------------------
const IDB_NAME    = 'parkingpro-sw';
const IDB_VERSION = 1;
const IDB_STORE   = 'offlineQueue';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        const store = db.createObjectStore(IDB_STORE, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

async function idbGetAll(db) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const req   = store.getAll();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

async function idbDelete(db, id) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const req   = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}

async function idbAdd(db, record) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const req   = store.add(record);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

async function idbUpdate(db, record) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const req   = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}

// ---------------------------------------------------------------------------
// Broadcast a message to all open window clients
// ---------------------------------------------------------------------------
async function broadcastToClients(message) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach((client) => client.postMessage(message));
}

// ---------------------------------------------------------------------------
// Cache size enforcement — evict oldest entries beyond the limit
// ---------------------------------------------------------------------------
async function trimCache(cacheName, maxEntries) {
  const cache   = await caches.open(cacheName);
  const keys    = await cache.keys();
  const surplus = keys.length - maxEntries;
  if (surplus > 0) {
    // oldest entries are at the front of the list
    const toEvict = keys.slice(0, surplus);
    await Promise.all(toEvict.map((key) => cache.delete(key)));
  }
}

// ---------------------------------------------------------------------------
// Add a response to a named cache and enforce its size limit
// ---------------------------------------------------------------------------
async function cacheAndTrim(cacheName, request, response, maxEntries) {
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
  // Trim asynchronously — do not block the response
  trimCache(cacheName, maxEntries).catch(() => {});
}

// ---------------------------------------------------------------------------
// INSTALL — precache the app shell
// ---------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        cache.addAll(
          PRECACHE_ASSETS.filter((a) => a !== '/offline.html')
        )
      )
      .then(() => {
        // Also pre-warm offline.html separately so a missing file doesn't
        // abort the whole install.
        return caches.open(STATIC_CACHE).then((cache) =>
          cache.add('/offline.html').catch(() => {})
        );
      })
      .catch((err) => {
        console.warn('[SW] Install precache partial failure:', err);
      })
  );
  // Activate immediately — new SW takes over without waiting
  self.skipWaiting();
});

// ---------------------------------------------------------------------------
// ACTIVATE — delete stale caches, claim clients
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !ALL_CACHES.includes(key))
            .map((key) => {
              console.log('[SW] Deleting old cache:', key);
              return caches.delete(key);
            })
        )
      )
      .then(async () => {
        // Register periodic background sync if supported
        if ('periodicSync' in self.registration) {
          try {
            await self.registration.periodicSync.register('refresh-dashboard', {
              minInterval: 15 * 60 * 1000, // 15 minutes
            });
          } catch (err) {
            console.warn('[SW] Periodic sync registration failed:', err);
          }
        }
        return self.clients.claim();
      })
  );
});

// ---------------------------------------------------------------------------
// FETCH — route to appropriate caching strategy
// ---------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only intercept same-origin and known API origins; ignore chrome-extension etc.
  if (!url.protocol.startsWith('http')) return;

  // ── Mutation requests (POST/PUT/PATCH/DELETE) ───────────────────────────
  if (request.method !== 'GET') {
    // For write endpoints that can be queued offline
    if (NETWORK_FIRST_QUEUE_ROUTES.some((re) => re.test(url.pathname))) {
      event.respondWith(networkFirstWithQueue(request));
    } else {
      // All other mutations: pass through, return offline error on failure
      event.respondWith(
        fetch(request).catch(() =>
          new Response(
            JSON.stringify({ error: 'Sin conexión al servidor', offline: true }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          )
        )
      );
    }
    return;
  }

  // ── GET routing ─────────────────────────────────────────────────────────

  // 1. Static assets → cache-first
  if (
    STATIC_ASSET_PATTERN.test(url.pathname) ||
    PRECACHE_ASSETS.includes(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // 2. Stale-while-revalidate API routes
  if (STALE_WHILE_REVALIDATE_ROUTES.some((re) => re.test(url.pathname))) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
    return;
  }

  // 3. Network-first (write-endpoint GETs should not be queued but get cache fallback)
  if (NETWORK_FIRST_QUEUE_ROUTES.some((re) => re.test(url.pathname))) {
    event.respondWith(networkFirstWithTimeout(request, API_CACHE, 10000));
    return;
  }

  // 4. Navigation requests → network-first with offline.html fallback
  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }

  // 5. All other API calls → network-first with 10 s timeout, cache fallback
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/rpc/')) {
    event.respondWith(networkFirstWithTimeout(request, API_CACHE, 10000));
    return;
  }

  // 6. Default → network-first then dynamic cache
  event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

// ---------------------------------------------------------------------------
// Strategy: Cache-First
// ---------------------------------------------------------------------------
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cacheAndTrim(cacheName, request, response.clone(), DYNAMIC_CACHE_MAX);
    }
    return response;
  } catch {
    return new Response('Asset not available offline', { status: 503 });
  }
}

// ---------------------------------------------------------------------------
// Strategy: Network-First (no timeout)
// ---------------------------------------------------------------------------
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cacheAndTrim(cacheName, request, response.clone(), DYNAMIC_CACHE_MAX);
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: 'Sin conexión al servidor', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ---------------------------------------------------------------------------
// Strategy: Network-First with configurable timeout + cache fallback
// ---------------------------------------------------------------------------
async function networkFirstWithTimeout(request, cacheName, timeoutMs) {
  const controller  = new AbortController();
  const timeoutId   = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (response.ok) {
      await cacheAndTrim(cacheName, request.clone(), response.clone(), API_CACHE_MAX);
    }
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    const cached = await caches.match(request);
    if (cached) {
      // Annotate so the client can tell this came from cache
      const headers = new Headers(cached.headers);
      headers.set('sw-served-from-cache', 'true');
      return new Response(cached.body, {
        status:     cached.status,
        statusText: cached.statusText,
        headers,
      });
    }
    return new Response(
      JSON.stringify({ error: 'Sin conexión al servidor', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ---------------------------------------------------------------------------
// Strategy: Stale-While-Revalidate
// ---------------------------------------------------------------------------
async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Always kick off a background revalidation
  const revalidate = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        const headers = new Headers(response.headers);
        headers.set('sw-cache-timestamp', Date.now().toString());
        const stamped = new Response(response.clone().body, {
          status:     response.status,
          statusText: response.statusText,
          headers,
        });
        await cache.put(request, stamped);
        await trimCache(cacheName, API_CACHE_MAX);
        // Notify clients that fresh data is available
        broadcastToClients({ type: 'CACHE_UPDATED', url: request.url }).catch(() => {});
      }
      return response;
    })
    .catch(() => null);

  if (cached) return cached;

  // No cache entry yet — wait for the network
  const fresh = await revalidate;
  if (fresh) return fresh;

  return new Response(
    JSON.stringify({ error: 'Sin conexión al servidor', offline: true }),
    { status: 503, headers: { 'Content-Type': 'application/json' } }
  );
}

// ---------------------------------------------------------------------------
// Strategy: Network-First with offline queue fallback (mutation endpoints)
// ---------------------------------------------------------------------------
async function networkFirstWithQueue(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch {
    // Serialize the request and push it onto the offline queue in IndexedDB
    await enqueueRequest(request);

    // Register a one-off background sync so the request replays when online
    if ('sync' in self.registration) {
      try {
        await self.registration.sync.register('sync-offline-queue');
      } catch (err) {
        console.warn('[SW] Sync registration failed:', err);
      }
    }

    broadcastToClients({ type: 'REQUEST_QUEUED', url: request.url }).catch(() => {});

    return new Response(
      JSON.stringify({ queued: true, message: 'Solicitud guardada. Se enviará cuando vuelva la conexión.' }),
      { status: 202, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ---------------------------------------------------------------------------
// Strategy: Navigation — network-first, fall back to /offline.html
// ---------------------------------------------------------------------------
async function navigationHandler(request) {
  try {
    const response = await fetch(request);
    // Cache successful navigations in the dynamic cache for faster next load
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    const appShell = await caches.match('/index.html');
    if (appShell) return appShell;

    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) return offlinePage;

    return new Response(
      `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
       <title>Sin conexión — ParkingPro</title></head><body>
       <h1>Sin conexión</h1>
       <p>La aplicación no está disponible sin internet en este momento.</p>
       </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

// ---------------------------------------------------------------------------
// Offline queue helpers
// ---------------------------------------------------------------------------
async function enqueueRequest(request) {
  try {
    const db   = await openDB();
    const body = await request.clone().text().catch(() => null);
    const entry = {
      url:       request.url,
      method:    request.method,
      headers:   [...request.headers.entries()].reduce((acc, [k, v]) => {
                   acc[k] = v; return acc;
                 }, {}),
      body,
      timestamp: Date.now(),
      retries:   0,
    };
    await idbAdd(db, entry);
    db.close();
  } catch (err) {
    console.error('[SW] Failed to enqueue request:', err);
  }
}

// ---------------------------------------------------------------------------
// BACKGROUND SYNC — replay queued requests with exponential backoff
// ---------------------------------------------------------------------------
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-queue') {
    event.waitUntil(replayOfflineQueue());
  }
});

async function replayOfflineQueue() {
  let db;
  try {
    db = await openDB();
  } catch (err) {
    console.error('[SW] Could not open IndexedDB for sync:', err);
    return;
  }

  const entries = await idbGetAll(db).catch(() => []);
  if (!entries.length) {
    db.close();
    return;
  }

  let successCount = 0;
  let failCount    = 0;

  for (const entry of entries) {
    // Exponential backoff: skip if the entry has been retried too recently
    const backoffMs = Math.min(30000, 1000 * Math.pow(2, entry.retries));
    if (entry.retries > 0 && Date.now() - entry.timestamp < backoffMs) {
      continue;
    }

    try {
      const response = await fetch(entry.url, {
        method:  entry.method,
        headers: entry.headers,
        body:    entry.body || undefined,
      });

      if (response.ok || (response.status >= 200 && response.status < 300)) {
        await idbDelete(db, entry.id);
        successCount++;
      } else if (response.status >= 400 && response.status < 500) {
        // Client error — no point retrying; discard the entry
        console.warn(`[SW] Discarding queued request ${entry.url} — HTTP ${response.status}`);
        await idbDelete(db, entry.id);
        failCount++;
      } else {
        // Server error — increment retry counter
        await idbUpdate(db, { ...entry, retries: entry.retries + 1, timestamp: Date.now() });
        failCount++;
      }
    } catch {
      // Network still down — increment retry counter and leave in queue
      await idbUpdate(db, { ...entry, retries: entry.retries + 1, timestamp: Date.now() }).catch(() => {});
      failCount++;
    }
  }

  db.close();

  broadcastToClients({
    type:         'SYNC_COMPLETE',
    successCount,
    failCount,
    remainingCount: entries.length - successCount,
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// PERIODIC SYNC — refresh dashboard data every 15 minutes
// ---------------------------------------------------------------------------
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'refresh-dashboard') {
    event.waitUntil(prefetchDashboardData());
  }
});

async function prefetchDashboardData() {
  const endpoints = [
    '/api/v1/reports/dashboard',
    '/api/v1/access/sessions/active',
  ];

  const cache = await caches.open(API_CACHE);

  await Promise.allSettled(
    endpoints.map(async (path) => {
      try {
        const response = await fetch(path);
        if (response.ok) {
          const headers = new Headers(response.headers);
          headers.set('sw-cache-timestamp', Date.now().toString());
          const stamped = new Response(response.clone().body, {
            status:     response.status,
            statusText: response.statusText,
            headers,
          });
          await cache.put(path, stamped);
        }
      } catch (err) {
        console.warn('[SW] Periodic prefetch failed for', path, err);
      }
    })
  );

  await trimCache(API_CACHE, API_CACHE_MAX);
  broadcastToClients({ type: 'DASHBOARD_REFRESHED', timestamp: Date.now() }).catch(() => {});
}

// ---------------------------------------------------------------------------
// PUSH NOTIFICATIONS (stub — wire up your VAPID key in the client)
// ---------------------------------------------------------------------------
self.addEventListener('push', (event) => {
  let data = { title: 'ParkingPro', body: 'Nueva notificación', icon: '/favicon.svg' };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body:    data.body,
    icon:    data.icon    || '/favicon.svg',
    badge:   data.badge   || '/favicon.svg',
    tag:     data.tag     || 'parkingpro-notification',
    data:    data.data    || {},
    actions: data.actions || [],
    vibrate: [200, 100, 200],
    requireInteraction: data.requireInteraction || false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Focus an existing tab if one is already open
        for (const client of clients) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new tab
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// ---------------------------------------------------------------------------
// NETWORK STATUS DETECTION — driven by messages from the client
// ---------------------------------------------------------------------------
let isOffline = false;

self.addEventListener('message', (event) => {
  if (!event.data || !event.data.type) return;

  switch (event.data.type) {
    // ── Client instructs SW to skip waiting and take over ─────────────────
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    // ── Client reports it has cleared its own caches ───────────────────────
    case 'CLEAR_CACHE':
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {});
      break;

    // ── Client reports network status change ───────────────────────────────
    case 'NETWORK_STATUS': {
      const online = event.data.online;
      if (online && isOffline) {
        // We just came back online
        isOffline = false;
        broadcastToClients({ type: 'ONLINE' }).catch(() => {});
        // Trigger a sync attempt
        if ('sync' in self.registration) {
          self.registration.sync.register('sync-offline-queue').catch(() => {});
        }
      } else if (!online && !isOffline) {
        // We just went offline
        isOffline = true;
        broadcastToClients({ type: 'OFFLINE' }).catch(() => {});
      }
      break;
    }

    // ── Client requests an immediate cache clear and re-precache ──────────
    case 'FORCE_REFRESH':
      event.waitUntil(
        caches
          .keys()
          .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
          .then(() => caches.open(STATIC_CACHE))
          .then((cache) => cache.addAll(PRECACHE_ASSETS))
          .catch(() => {})
      );
      break;

    default:
      break;
  }
});
