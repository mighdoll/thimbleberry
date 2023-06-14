import { Cache, memoMemo, StringKeyFn } from "./MemoMemo";
import { WeakCache } from "./WeakCache";

/** Support for memoizing functions using a weak reference cache.  */
export function weakMemoCache<V extends object>(): Cache<V> {
  return new WeakCache<string, V>();
}

/** Memoize a function, holding the result values with weak references.
 *
 * By default, the memoization cache key is constructed by stringifying
 * only the first argument to the function.
 */
export function weakMemoize<V extends object>(
  fn: (...args: any[]) => V,
  options?: { keyFn?: StringKeyFn }
): (...args: any[]) => V {
  return memoMemo<V>(fn, { memoCache: weakMemoCache, keyFn: options?.keyFn });
}
