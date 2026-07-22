import '@testing-library/jest-dom/vitest';

// Node 22+ defines its own globalThis.localStorage (backed by --localstorage-file)
// which shadows the working implementation and throws on every method call — and
// under Node 25 the jsdom-provided window storage is affected too. Install a
// functional in-memory Storage whenever the current one is broken.
function makeMemoryStorage(): Storage {
  let store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => {
      store = new Map();
    },
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  let broken = true;
  try {
    const existing = (globalThis as Record<string, unknown>)[name] as Storage | undefined;
    existing?.setItem('__probe__', '1');
    broken = existing?.getItem('__probe__') !== '1';
    existing?.removeItem('__probe__');
  } catch {
    broken = true;
  }
  if (broken) {
    const memory = makeMemoryStorage();
    Object.defineProperty(globalThis, name, { value: memory, configurable: true, writable: true });
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, name, { value: memory, configurable: true, writable: true });
    }
  }
}
