/** a cache of weakly referenced values.
 *
 * Values are weakly referenced, and may be garbage collected.
 *
 * The cache keys are strongly referenced, but deleted lazily
 * from the underlying cache.
 */
export class WeakCache<K, V extends object> {
  private cache = new Map<K, WeakRef<V>>();

  private registry = new FinalizationRegistry((key: K) => {
    this._expire(key);
  });

  set(key: K, value: V): void {
    this.cache.set(key, new WeakRef(value));
    this.registry.register(value, key);
  }

  get(key: K): V | undefined {
    const found = this.cache.get(key);
    const value = found?.deref();
    if (value !== undefined) {
      return value;
    }
    if (found) {
      this.cache.delete(key);
    }
    return undefined;
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  fetchFill(key: K, fn: () => V): V {
    const found = this.get(key);
    if (found) {
      return found;
    }
    const value = fn();
    this.set(key, value);
    return value;
  }

  // exposed for testing
  _expire(key: K): void {
    this.cache.delete(key);
  }
}
