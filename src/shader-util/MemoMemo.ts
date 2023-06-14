export type MemoFn<V extends object> = (...args: any[]) => V;
export type StringKeyFn = (...args: any[]) => string;

/** API for pluggable cache */
export interface Cache<V extends object> {
  get(key: string): V | undefined;
  set(key: string, value: V): void;
}

interface MemoizeOptions<V extends object> {
  /** convert memoized function arguments to a string for use as a cache key */
  keyFn?: StringKeyFn;

  /** a cache to hold memoized values from string keys */
  memoCache?: () => Cache<V>;
}

/**
 * Memoize a function, optionally using a custom cache.
 *
 * The memoize cache uses string keys. By default the first argument is
 * json serialized to produce the cache key.
 *
 * See `weakMemoize` for a variant that uses weak references.
 *
 * @param fn function to memoize
 * @param options optionally specify key generation function or memo cache constructor
 * @returns memoized function
 */
export function memoMemo<V extends object>(
  fn: MemoFn<V>,
  options?: MemoizeOptions<V>
): MemoFn<V> {
  const memoizer = options?.memoCache || persistentMemoCache;
  const keyFn = options?.keyFn || defaultKeyFn;

  const cache = memoizer();

  return function (...args: any[]): V {
    const key = keyFn(...args);
    const found = cache.get(key);
    if (found !== undefined) {
      return found;
    } else {
      const value = fn(...args);
      cache.set(key, value);
      return value;
    }
  };
}

/** default memoization cache is simply a javascript map. Entries will never expire. */
function persistentMemoCache<V extends object>(): Cache<V> {
  return new Map<string, V>();
}

/** by default json serialize the first argument to produce the string key */
function defaultKeyFn(...args: any[]): string {
  return JSON.stringify(args[0] ?? "");
}
