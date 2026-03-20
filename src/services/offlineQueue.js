// ─────────────────────────────────────────────────────────────────────────────
// ParkingPro Offline Queue — IndexedDB-backed with full sync engine
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME = 'parkingpro-offline';
const DB_VERSION = 1;
const STORE_QUEUE = 'queue';
const STORE_CACHE = 'cache';

const MAX_RETRIES = 5;
const COMPLETED_TTL_MS = 24 * 60 * 60 * 1000;   // 24 hours
const FAILED_TTL_MS   =  7 * 24 * 60 * 60 * 1000; // 7 days
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;        // 1 hour
const PERIODIC_SYNC_MS    = 30 * 1000;             // 30 seconds

// ─── Priority levels ──────────────────────────────────────────────────────────
const PRIORITY = {
  CRITICAL: 1, // entry / exit operations
  HIGH:     2, // payment operations
  NORMAL:   3, // everything else
};

// ─── Minimal promise-based IndexedDB wrapper ─────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // ── 'queue' object store ──────────────────────────────────────────────
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const queueStore = db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
        queueStore.createIndex('status',    'status',    { unique: false });
        queueStore.createIndex('priority',  'priority',  { unique: false });
        queueStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // ── 'cache' object store ──────────────────────────────────────────────
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        const cacheStore = db.createObjectStore(STORE_CACHE, { keyPath: 'key' });
        cacheStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };

    request.onsuccess  = (e) => resolve(e.target.result);
    request.onerror    = (e) => reject(e.target.error);
    request.onblocked  = ()  => reject(new Error('IndexedDB open blocked'));
  });
}

// Returns a transaction's object store.
// mode: 'readonly' | 'readwrite'
function getStore(db, storeName, mode = 'readonly') {
  return db.transaction(storeName, mode).objectStore(storeName);
}

// Wrap an IDBRequest in a Promise.
function idbRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

// Collect all records from a cursor request into an array.
function idbCursorAll(req) {
  return new Promise((resolve, reject) => {
    const results = [];
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

// ─── Priority detection ───────────────────────────────────────────────────────

function detectPriority(url = '') {
  if (
    url.includes('/entry') ||
    url.includes('/exit')  ||
    url.includes('register_entry') ||
    url.includes('register_exit')
  ) {
    return PRIORITY.CRITICAL;
  }
  if (url.includes('/payment') || url.includes('payment')) {
    return PRIORITY.HIGH;
  }
  return PRIORITY.NORMAL;
}

// ─── Event helpers ────────────────────────────────────────────────────────────

function emit(name, detail = {}) {
  try {
    window.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
  } catch (_) {
    // Non-browser environment — ignore
  }
}

// ─── OfflineQueue class ───────────────────────────────────────────────────────

class OfflineQueue {
  constructor() {
    /** @type {IDBDatabase|null} */
    this._db          = null;
    this._dbReady     = this._initDB();
    this._syncing     = false;
    this._syncRetryId = null;
    this._periodicId  = null;
    this._cleanupId   = null;

    this._attachListeners();
  }

  // ── Initialisation ──────────────────────────────────────────────────────────

  async _initDB() {
    this._db = await openDB();
    await this._cleanup();
    this._schedulePeriodicSync();
    this._scheduleCleanup();
    return this._db;
  }

  async _ready() {
    if (this._db) return this._db;
    return this._dbReady;
  }

  // ── Event listeners ─────────────────────────────────────────────────────────

  _attachListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      emit('offlinequeue:status', { online: true });
      this.startSync();
    });

    // Service-worker background sync
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'BACKGROUND_SYNC') {
          this.startSync();
        }
      });
    }
  }

  _schedulePeriodicSync() {
    if (this._periodicId) clearInterval(this._periodicId);
    this._periodicId = setInterval(() => {
      if (navigator.onLine) this.startSync();
    }, PERIODIC_SYNC_MS);
  }

  _scheduleCleanup() {
    if (this._cleanupId) clearInterval(this._cleanupId);
    this._cleanupId = setInterval(() => this._cleanup(), CLEANUP_INTERVAL_MS);
  }

  // ── Queue operations ────────────────────────────────────────────────────────

  /**
   * Add a request to the queue.
   * @param {{ url: string, method?: string, data?: any, headers?: object }} request
   * @returns {Promise<string>} The generated item id.
   */
  async enqueue(request) {
    const db = await this._ready();
    const item = {
      id:        crypto.randomUUID(),
      url:       request.url || '',
      method:    request.method || 'POST',
      data:      request.data   || null,
      headers:   request.headers || {},
      status:    'pending',
      priority:  detectPriority(request.url),
      retries:   0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      completedAt: null,
      lastError:   null,
    };

    const store = getStore(db, STORE_QUEUE, 'readwrite');
    await idbRequest(store.add(item));

    emit('offlinequeue:enqueued', { item });
    return item.id;
  }

  /**
   * Get (and return) the next pending item ordered by priority then createdAt.
   * Does NOT remove the item — use remove(id) explicitly if needed.
   * @returns {Promise<object|null>}
   */
  async dequeue() {
    const items = await this.getAll('pending');
    if (!items.length) return null;
    items.sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt);
    return items[0];
  }

  /**
   * View the next pending item without removing it.
   * @returns {Promise<object|null>}
   */
  async peek() {
    return this.dequeue();
  }

  /**
   * Update the status (and optionally error) of a queue item.
   * @param {string} id
   * @param {string} status
   * @param {string|Error|null} [error]
   */
  async updateStatus(id, status, error = null) {
    const db = await this._ready();
    const tx    = db.transaction(STORE_QUEUE, 'readwrite');
    const store = tx.objectStore(STORE_QUEUE);
    const item  = await idbRequest(store.get(id));
    if (!item) return;

    item.status    = status;
    item.updatedAt = Date.now();
    if (status === 'completed') item.completedAt = Date.now();
    if (error !== null) item.lastError = String(error);

    await idbRequest(store.put(item));
  }

  /**
   * Get all items, optionally filtered by status.
   * @param {string} [status]
   * @returns {Promise<object[]>}
   */
  async getAll(status) {
    const db    = await this._ready();
    const store = getStore(db, STORE_QUEUE, 'readonly');

    if (status) {
      const index = store.index('status');
      return idbCursorAll(index.openCursor(IDBKeyRange.only(status)));
    }
    return idbRequest(store.getAll());
  }

  /**
   * Remove a specific item by id.
   * @param {string} id
   */
  async remove(id) {
    const db    = await this._ready();
    const store = getStore(db, STORE_QUEUE, 'readwrite');
    await idbRequest(store.delete(id));
  }

  /**
   * Remove all items from the queue.
   */
  async clear() {
    const db    = await this._ready();
    const store = getStore(db, STORE_QUEUE, 'readwrite');
    await idbRequest(store.clear());
  }

  /**
   * Count items, optionally filtered by status.
   * @param {string} [status]
   * @returns {Promise<number>}
   */
  async count(status) {
    const db    = await this._ready();
    const store = getStore(db, STORE_QUEUE, 'readonly');

    if (status) {
      const index = store.index('status');
      return idbRequest(index.count(IDBKeyRange.only(status)));
    }
    return idbRequest(store.count());
  }

  /**
   * Return aggregated statistics.
   * @returns {Promise<{ pending: number, syncing: number, failed: number, completed: number, total: number }>}
   */
  async getStats() {
    const [pending, syncing, failed, completed, total] = await Promise.all([
      this.count('pending'),
      this.count('syncing'),
      this.count('failed'),
      this.count('completed'),
      this.count(),
    ]);
    return { pending, syncing, failed, completed, total };
  }

  // ── Sync engine ─────────────────────────────────────────────────────────────

  /**
   * Process all pending/failed items in priority order.
   */
  async startSync() {
    if (this._syncing || !navigator.onLine) return;
    this._syncing = true;

    // Cancel any pending retry since we're starting now
    if (this._syncRetryId !== null) {
      clearTimeout(this._syncRetryId);
      this._syncRetryId = null;
    }

    try {
      // Re-mark any items stuck as 'syncing' (from a previous aborted run) back
      // to 'pending' so they are retried.
      const stuckItems = await this.getAll('syncing');
      for (const item of stuckItems) {
        await this.updateStatus(item.id, 'pending');
      }

      const allPending = [
        ...(await this.getAll('pending')),
        ...(await this.getAll('failed')),
      ];

      if (!allPending.length) return;

      // Sort: highest priority (1) first, then oldest first (FIFO)
      allPending.sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt);

      for (const item of allPending) {
        // Re-read the item in case its state changed during a previous iteration
        const db    = await this._ready();
        const store = getStore(db, STORE_QUEUE, 'readonly');
        const fresh = await idbRequest(store.get(item.id));
        if (!fresh || (fresh.status !== 'pending' && fresh.status !== 'failed')) continue;

        await this._syncItem(fresh);

        // If we went offline during this loop, stop and schedule a retry
        if (!navigator.onLine) {
          this._scheduleSyncRetry(5000);
          break;
        }
      }
    } finally {
      this._syncing = false;
      const stats = await this.getStats();
      emit('offlinequeue:status', { stats });
    }
  }

  /** Convenience alias */
  sync() {
    return this.startSync();
  }

  /**
   * Attempt to sync a single queue item with exponential back-off.
   * @param {object} item
   */
  async _syncItem(item) {
    await this.updateStatus(item.id, 'syncing');

    const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
      ? import.meta.env.VITE_API_URL
      : 'http://localhost:3000';

    const getToken = () => {
      try { return localStorage.getItem('pp_token') || ''; } catch { return ''; }
    };

    let lastError = null;

    try {
      const response = await fetch(`${API_BASE}${item.url}`, {
        method: item.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
          ...(item.headers || {}),
        },
        body: item.data ? JSON.stringify(item.data) : undefined,
      });

      // Auth failures — no point retrying
      if (response.status === 401 || response.status === 403) {
        await this.updateStatus(item.id, 'auth_failed', `HTTP ${response.status}`);
        emit('offlinequeue:failed', { item, reason: 'auth', status: response.status });
        return;
      }

      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error || json.message || response.statusText);
      }

      // Success
      await this.updateStatus(item.id, 'completed');
      emit('offlinequeue:synced', { item });
      return;

    } catch (err) {
      if (!navigator.onLine) {
        // Network went down — restore to pending and bail out of sync loop
        await this.updateStatus(item.id, 'pending');
        this._scheduleSyncRetry(5000);
        return;
      }
      lastError = err;
    }

    // Handle retry logic
    const retries = (item.retries || 0) + 1;
    if (retries > MAX_RETRIES) {
      await this._markFailed(item.id, retries, lastError);
      emit('offlinequeue:failed', { item, reason: 'max_retries', error: String(lastError) });
      return;
    }

    const backoffMs = Math.min(Math.pow(2, retries - 1) * 1000, 32000);
    await this._markFailed(item.id, retries, lastError);
    this._scheduleSyncRetry(backoffMs);
  }

  async _markFailed(id, retries, error) {
    const db    = await this._ready();
    const tx    = db.transaction(STORE_QUEUE, 'readwrite');
    const store = tx.objectStore(STORE_QUEUE);
    const item  = await idbRequest(store.get(id));
    if (!item) return;
    item.status    = 'failed';
    item.retries   = retries;
    item.lastError = error ? String(error) : null;
    item.updatedAt = Date.now();
    await idbRequest(store.put(item));
  }

  /**
   * Schedule a sync retry after a delay.
   * @param {number} delayMs
   */
  scheduleSyncRetry(delayMs) {
    this._scheduleSyncRetry(delayMs);
  }

  _scheduleSyncRetry(delayMs) {
    if (this._syncRetryId !== null) return; // already scheduled
    this._syncRetryId = setTimeout(() => {
      this._syncRetryId = null;
      this.startSync();
    }, delayMs);
  }

  // ── Offline data cache ──────────────────────────────────────────────────────

  /**
   * Store arbitrary data in the cache object store.
   * @param {string} key
   * @param {any} data
   */
  async cacheData(key, data) {
    const db    = await this._ready();
    const store = getStore(db, STORE_CACHE, 'readwrite');
    await idbRequest(store.put({ key, data, updatedAt: Date.now() }));
  }

  /**
   * Retrieve cached data for a key.
   * @param {string} key
   * @param {number} [maxAgeMs] - If provided, returns null when data is older than maxAgeMs.
   * @returns {Promise<any|null>}
   */
  async getCachedData(key, maxAgeMs) {
    const db    = await this._ready();
    const store = getStore(db, STORE_CACHE, 'readonly');
    const record = await idbRequest(store.get(key));
    if (!record) return null;
    if (maxAgeMs !== undefined && Date.now() - record.updatedAt > maxAgeMs) return null;
    return record.data;
  }

  /**
   * Remove all entries from the cache object store.
   */
  async clearCache() {
    const db    = await this._ready();
    const store = getStore(db, STORE_CACHE, 'readwrite');
    await idbRequest(store.clear());
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  /**
   * Purge stale completed and failed items.
   */
  async _cleanup() {
    const db    = await this._ready();
    const now   = Date.now();

    const tx    = db.transaction(STORE_QUEUE, 'readwrite');
    const store = tx.objectStore(STORE_QUEUE);
    const all   = await idbRequest(store.getAll());

    const toDelete = all.filter((item) => {
      if (item.status === 'completed' && item.completedAt) {
        return now - item.completedAt > COMPLETED_TTL_MS;
      }
      if (item.status === 'failed' && item.updatedAt) {
        return now - item.updatedAt > FAILED_TTL_MS;
      }
      return false;
    });

    await Promise.all(toDelete.map((item) => idbRequest(store.delete(item.id))));
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const offlineQueue = new OfflineQueue();
