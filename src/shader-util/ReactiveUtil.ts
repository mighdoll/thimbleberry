import { onCleanup, Reactive } from "@reactively/core";
import { HasReactive } from "@reactively/decorate";
import { HasDestroy, TrackContext, trackRelease, trackUse } from "./TrackUse";

/** A collection of initialization parameters to initializate properties
 * in a HasReactive derived instance.
 * Each key in the params object is the name of a property to initialize.
 */
export type ReactiveParams<T> = {
  [K in keyof T]?: ValueOrFn<T[K]>;
};

/**
 * Each value in the params object can be a javascript value, or a function that returns a value.
 * In all cases, the reactive class will have a reactive property returning a value of the same type.
 * In all cases, other reactive functions can reference the reactive property and will re-execute
 * automatically as needed.
 * Mutating the value of a reactive property depends on the initial value:
 *   . Reactive properties containing a javascript value only change when the
 *       programmer explicitly mutates the value.
 *   . Reactive properties containing a function will re-execute when they are referenced
 *       if any of their sources have changed.
 */
export type ValueOrFn<T> = T | (() => T);

/** initialize properties in a HasReactive or ExtendedReactive class from supplied and default parameters */
export function assignParams<T>(
  target: T,
  params: ReactiveParams<T>,
  defaults?: Partial<Record<keyof T, unknown>>
): void {
  // assign parameters
  updateProperties(target, params as Partial<T>);

  // assign defaults
  const paramKeys = Object.keys(params);
  for (const key in defaults) {
    if (!paramKeys.includes(key)) {
      target[key] = defaults[key] as any;
    }
  }

  verifyReactiveAssigned(target, params, defaults);
}

/** verify that all reactive properties are initialized */
function verifyReactiveAssigned<T>(
  target: T,
  params: ReactiveParams<T>,
  defaults?: Partial<Record<keyof T, unknown>>
): void {
  const validDefaults = defaults || {};
  const assignedKeys = [...Object.keys(params), ...Object.keys(validDefaults)];
  const reactiveTarget = target as HasReactive;

  for (const key in reactiveTarget.__reactive) {
    const node = reactiveTarget.__reactive[key] as any;
    if (
      node._value === undefined &&
      node.fn === undefined &&
      !assignedKeys.includes(key)
    ) {
      const message = `Property ${key} is not initialized. Perhaps set a default value?`;
      console.error(message, target);
    }
  }
}

/** return the underlying Reactive node from a HasReactive reactively decorated
 * instance property */
export function reactiveProp<T extends HasReactive, K extends string & keyof T>(
  target: T,
  key: K
): Reactive<T[K]> {
  const value = target.__reactive![key];
  if (!value) {
    /* unfortunately, we have to check at runtime to see whether the requested property
     * is @reactively decorated.
     * TS doesn't currently allow us to do identify decorated keys at compile time
     * see: https://github.com/microsoft/TypeScript/issues/48413 */
    const message = `Property ${key} is not reactive`;
    console.error(message, target);
    throw new Error(message);
  }
  return target.__reactive![key] as Reactive<T[K]>;
}

/** (for use within reactively reaction).
 * Track a destroyable resource and release the resource if the reaction reruns */
export function reactiveTrackUse(target: HasDestroy, context: TrackContext): void {
  trackUse(target, context);
  onCleanup(() => trackRelease(target, context));
}

export function updateProperties<T>(dest: T, updates: Partial<T>): void {
  for (const key in updates) {
    dest[key] = updates[key] as any;
  }
}
