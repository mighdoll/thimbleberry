/**
 * Track a destroyable resource and destroy it when it is no longer needed.
 *
 * Resources are marked for tracking with trackUse. Used resources are scoped by one or
 * more UsageContext containers.
 * A UsageContext can be provided explicitly to trackUse, and/or implicitly by an
 * enclosing withUsage or withAsyncUsage call.
 *
 * Resources are reference counted to handle overlapping/async contexts. The resource
 * will be destroyed when all enclosing UsagedContexts have finished.
 */
export interface HasDestroy {
  destroy(): void;
}

/** a container to track destroyable resources */
export interface UsageContext {
  /** exit the context and destroy any unreferenced resources */
  finish(): void;

  _addRef(target: HasDestroy): void;
  _removeRef(target: HasDestroy): void;
}

// The UsageContexts hold hard references to the tracked objects.
// But if the user loses track of a context, we won't hold the last
// reference and keep it from being gc'd. So we use a weak map here.

/** reference count of resources */
const resources = new WeakMap<HasDestroy, number>();

/** stack of active usage contexts for withUsage or withAsyncUsage */
const autoContextStack: UsageContext[] = [];

// for tests, track the number of tracked and destoryed objects
let trackCount = 0;
let destroyCount = 0;

/** track a destroyable resource */
export function trackUse<T extends HasDestroy>(target: T, context?: TrackContext): T {
  const refCount = resources.get(target) || 0;
  if (refCount === 0) {
    trackCount++;
  }
  resources.set(target, refCount + 1);
  last(autoContextStack)?._addRef(target);
  context?._addRef(target);
  return target;
}

/** explicitly untrack a resource */
export function trackRelease<T extends HasDestroy>(
  target: T,
  context?: UsageContext
): void {
  const refCount = resources.get(target) || 0;
  if (refCount === 1) {
    destroyCount++;
    resources.delete(target);
    context?._removeRef(target);
    last(autoContextStack)?._removeRef(target);
    // dlog("destroy", target);
    target.destroy();
  } else {
    resources.set(target, refCount - 1);
  }
}

/** a usage context for automatically tracking resources used in a fn or async fn */
class AutoContext implements UsageContext {
  refs = new Set<HasDestroy>();
  constructor() {
    autoContextStack.push(this as UsageContext);
  }

  finish(): void {
    this.refs.forEach(target => trackRelease(target, this));
    autoContextStack.pop();
  }

  _addRef(target: HasDestroy): void {
    this.refs.add(target);
  }

  _removeRef(target: HasDestroy): void {
    this.refs.delete(target);
  }
}

/** a usage context for manually adding a context to trackUse() */
export class TrackContext implements UsageContext {
  refs = new Set<HasDestroy>();

  finish(): void {
    this.refs.forEach(target => trackRelease(target, this));
  }

  _addRef(target: HasDestroy): void {
    this.refs.add(target);
  }

  _removeRef(target: HasDestroy): void {
    this.refs.delete(target);
  }
}

/** destroy tracked resources allocated during function execution */
export function withUsage<T>(fn: () => T): T {
  const usage = new AutoContext();
  let result;
  try {
    result = fn();
  } finally {
    usage.finish();
  }
  return result;
}

/** destroy tracked resources allocated during async function execution */
export async function withAsyncUsage<T>(fn: () => Promise<T>): Promise<T> {
  const usage = new AutoContext();
  let result;
  try {
    result = await fn();
  } finally {
    usage.finish();
  }
  return result;
}

/** create a usage context in which to track resources */
export function trackContext(): TrackContext {
  return new TrackContext();
}

/** (for tests) log an error and throw if all tracked resources are not released. */
export async function withLeakTrack<T>(fn: () => Promise<T>, expectLeak = 0): Promise<T> {
  const startTrack = trackCount;
  const startDestroy = destroyCount;
  const result = await fn();
  const netDestroyed = destroyCount - startDestroy;
  const netTracked = trackCount - startTrack;

  if (netTracked - netDestroyed != expectLeak) {
    const message = `trackUse: ${netTracked} tracked, ${netDestroyed} destroyed`;
    console.error(message);
    throw new Error(message);
  }

  return result;
}

/** optionally return the last element of an array */
function last<T>(a: T[]): T | undefined {
  return a[a.length - 1];
}
