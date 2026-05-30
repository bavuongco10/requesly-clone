import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

type Listener = (...args: unknown[]) => void;

function createEvent() {
  const listeners = new Set<Listener>();
  return {
    addListener: (fn: Listener) => listeners.add(fn),
    removeListener: (fn: Listener) => listeners.delete(fn),
    hasListener: (fn: Listener) => listeners.has(fn),
    _emit: (...args: unknown[]) => {
      for (const fn of listeners) fn(...args);
    },
    _clear: () => listeners.clear(),
  };
}

function createStorageArea() {
  let store: Record<string, unknown> = {};
  return {
    get: vi.fn(async (keys?: string | string[] | Record<string, unknown> | null) => {
      if (keys == null) return { ...store };
      if (typeof keys === "string") {
        return keys in store ? { [keys]: store[keys] } : {};
      }
      if (Array.isArray(keys)) {
        const out: Record<string, unknown> = {};
        for (const k of keys) if (k in store) out[k] = store[k];
        return out;
      }
      const out: Record<string, unknown> = { ...keys };
      for (const k of Object.keys(keys)) if (k in store) out[k] = store[k];
      return out;
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      store = { ...store, ...items };
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      const arr = Array.isArray(keys) ? keys : [keys];
      for (const k of arr) delete store[k];
    }),
    clear: vi.fn(async () => {
      store = {};
    }),
    _dump: () => ({ ...store }),
    _reset: () => {
      store = {};
    },
  };
}

const chromeMock = {
  storage: {
    local: createStorageArea(),
    onChanged: createEvent(),
  },
  declarativeNetRequest: {
    updateDynamicRules: vi.fn(async () => undefined),
    getDynamicRules: vi.fn(async () => []),
    MAX_NUMBER_OF_DYNAMIC_RULES: 30000,
  },
  scripting: {
    executeScript: vi.fn(async () => []),
    insertCSS: vi.fn(async () => undefined),
    removeCSS: vi.fn(async () => undefined),
  },
  runtime: {
    onInstalled: createEvent(),
    onMessage: createEvent(),
    lastError: undefined as { message: string } | undefined,
  },
  tabs: {
    query: vi.fn(async () => []),
    onUpdated: createEvent(),
  },
};

// @ts-expect-error assign mock onto global
globalThis.chrome = chromeMock;

afterEach(() => {
  vi.clearAllMocks();
  chromeMock.storage.local._reset();
  chromeMock.storage.onChanged._clear();
});
