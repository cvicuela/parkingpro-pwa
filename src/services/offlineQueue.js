const QUEUE_KEY = 'pp_offline_queue';
const MAX_QUEUE_SIZE = 100;
const COMPLETED_TTL = 86400000; // 24 hours in ms

// Priority levels: lower number = higher priority
const PRIORITY = {
  entry: 1,
  exit: 1,
  payment: 2,
  default: 3,
};

const getPriority = (item) => {
  const url = item.url || '';
  if (url.includes('/entry') || url.includes('/exit') || url.includes('register_entry') || url.includes('register_exit')) return PRIORITY.entry;
  if (url.includes('/payment') || url.includes('payment')) return PRIORITY.payment;
  return PRIORITY.default;
};

class OfflineQueue {
  constructor() {
    this._syncing = false;
    this._retryTimeouts = {};
    window.addEventListener('online', () => this.sync());
    // Clean completed items on startup
    this._cleanCompleted();
  }

  getQueue() {
    try {
      return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  _saveQueue(queue) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }

  add(request) {
    const queue = this.getQueue();

    // Enforce max queue size — drop lowest priority oldest items first
    if (queue.length >= MAX_QUEUE_SIZE) {
      const sorted = [...queue].sort((a, b) => {
        const pa = getPriority(a);
        const pb = getPriority(b);
        if (pa !== pb) return pa - pb; // keep higher priority (lower number)
        return a.timestamp - b.timestamp; // keep newer items
      });
      // Remove the last (lowest priority, oldest)
      sorted.pop();
      queue.length = 0;
      queue.push(...sorted);
    }

    const item = {
      ...request,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      status: 'pending',
      attempts: 0,
      priority: getPriority(request),
    };

    queue.push(item);
    this._saveQueue(queue);
    return item.id;
  }

  updateStatus(id, status, error = null) {
    const queue = this.getQueue();
    const idx = queue.findIndex(i => i.id === id);
    if (idx === -1) return;
    queue[idx].status = status;
    if (status === 'completed') queue[idx].completedAt = Date.now();
    if (error) queue[idx].lastError = String(error);
    this._saveQueue(queue);
  }

  _cleanCompleted() {
    const queue = this.getQueue();
    const now = Date.now();
    const filtered = queue.filter(item => {
      if (item.status === 'completed' && item.completedAt) {
        return (now - item.completedAt) < COMPLETED_TTL;
      }
      return true;
    });
    if (filtered.length !== queue.length) {
      this._saveQueue(filtered);
    }
  }

  clear() {
    localStorage.removeItem(QUEUE_KEY);
  }

  clearCompleted() {
    const queue = this.getQueue().filter(i => i.status !== 'completed');
    this._saveQueue(queue);
  }

  async sync() {
    if (this._syncing || !navigator.onLine) return;
    this._syncing = true;
    this._cleanCompleted();

    const queue = this.getQueue();
    const pending = queue
      .filter(i => i.status === 'pending' || i.status === 'failed')
      .sort((a, b) => (a.priority || 3) - (b.priority || 3) || a.timestamp - b.timestamp);

    if (pending.length === 0) {
      this._syncing = false;
      return;
    }

    const API_BASE = import.meta.env?.VITE_API_URL || 'http://localhost:3000';
    const getToken = () => localStorage.getItem('pp_token') || '';

    for (const item of pending) {
      this.updateStatus(item.id, 'syncing');

      let success = false;
      let lastError = null;
      const maxAttempts = 3;
      let delay = 500;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const response = await fetch(`${API_BASE}${item.url}`, {
            method: item.method || 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${getToken()}`,
              ...(item.headers || {}),
            },
            body: item.data ? JSON.stringify(item.data) : undefined,
          });

          if (!response.ok) {
            const json = await response.json().catch(() => ({}));
            throw new Error(json.error || json.message || response.statusText);
          }

          success = true;
          break;
        } catch (err) {
          lastError = err;
          const msg = err?.message || '';
          // Don't retry auth/permission errors
          if (msg.includes('Token') || msg.includes('Acceso') || msg.includes('sesión')) break;
          if (attempt < maxAttempts - 1) {
            await new Promise(r => setTimeout(r, delay));
            delay *= 2; // exponential backoff
          }
        }
      }

      if (success) {
        this.updateStatus(item.id, 'completed');
      } else {
        const currentQueue = this.getQueue();
        const idx = currentQueue.findIndex(i => i.id === item.id);
        if (idx !== -1) {
          currentQueue[idx].status = 'failed';
          currentQueue[idx].attempts = (currentQueue[idx].attempts || 0) + 1;
          currentQueue[idx].lastError = String(lastError);
          this._saveQueue(currentQueue);
        }
      }
    }

    this._syncing = false;
  }

  get pendingCount() {
    return this.getQueue().filter(i => i.status === 'pending' || i.status === 'failed').length;
  }

  get statusSummary() {
    const queue = this.getQueue();
    return {
      pending: queue.filter(i => i.status === 'pending').length,
      syncing: queue.filter(i => i.status === 'syncing').length,
      failed: queue.filter(i => i.status === 'failed').length,
      completed: queue.filter(i => i.status === 'completed').length,
      total: queue.length,
    };
  }
}

export const offlineQueue = new OfflineQueue();
