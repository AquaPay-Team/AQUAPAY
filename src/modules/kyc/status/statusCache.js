const DEFAULT_TTL_MS = 30_000;
const DEFAULT_MAX_SIZE = 10_000;

class StatusCache {
  constructor({ ttlMs = DEFAULT_TTL_MS, maxSize = DEFAULT_MAX_SIZE } = {}) {
    this._ttlMs = ttlMs;
    this._maxSize = maxSize;
    this._store = new Map();
  }

  get(key) {
    const entry = this._store.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this._store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value) {
    if (this._store.has(key)) {
      this._store.delete(key);
    }

    if (this._store.size >= this._maxSize) {
      this._evict();
    }

    this._store.set(key, {
      value,
      expiresAt: Date.now() + this._ttlMs,
    });
  }

  invalidate(key) {
    this._store.delete(key);
  }

  clear() {
    this._store.clear();
  }

  get size() {
    return this._store.size;
  }

  _evict() {
    const now = Date.now();
    for (const [k, v] of this._store) {
      if (now >= v.expiresAt) {
        this._store.delete(k);
        return;
      }
    }
    const oldestKey = this._store.keys().next().value;
    if (oldestKey !== undefined) {
      this._store.delete(oldestKey);
    }
  }
}

export { StatusCache };
export default StatusCache;
