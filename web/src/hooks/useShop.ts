// Active shop ID — persisted in localStorage for multi-shop users.
// Single-shop users never need this; the server auto-resolves their shop.

let _activeShopId: string | null = null;

try {
  _activeShopId = localStorage.getItem('juakali_active_shop');
} catch {
  // ignore storage errors (private mode, etc.)
}

const _listeners = new Set<() => void>();

export const shopStore = {
  getShopId(): string | null {
    return _activeShopId;
  },
  setShopId(id: string) {
    _activeShopId = id;
    try {
      localStorage.setItem('juakali_active_shop', id);
    } catch {}
    _listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },
};

/** Returns the X-Shop-Id header value for API calls, or empty object if not set. */
export function shopHeader(): Record<string, string> {
  const id = shopStore.getShopId();
  return id ? { 'X-Shop-Id': id } : {};
}
