import { Cache, memoMemo } from "./MemoMemo";

interface HasDevice {
  device: GPUDevice;
}

type DeviceMemoFn<T extends HasDevice, V extends object> = (paramsObj: T) => V;

type MemoFnWithCacheControl<T extends HasDevice, V extends object> = (
  paramsObj: T,
  memoCache?: () => Cache<V>
) => V;

/**
 * Memoize a function such as a GPU pipeline builder.
 * The first argument to the function is expected to an object containing parameter fields including a GPUDevice.
 *
 * The GPUDevice is serialized by label, which is handy for tests that use multiple GPUDevices
 * and memoization using string keys.
 *
 * @returns memoized function with an optional additional parameter to allow configuration memo caching
 */
export function memoizeWithDevice<T extends HasDevice, V extends object>(
  fn: DeviceMemoFn<T, V>
): MemoFnWithCacheControl<T, V> {
  const keyFn = cacheKeyWithDevice;
  let memoFn: DeviceMemoFn<T, V>;

  return function (paramsObj: T, memoCache?: () => Cache<V>): V {
    if (!memoFn) {
      memoFn = memoMemo(fn, { keyFn, memoCache });
    }
    return memoFn(paramsObj);
  };
}

/** Stringify the GPUDevice label and the other object parameters for use as a string cache key */
export function cacheKeyWithDevice<T extends HasDevice>(paramsObj: T): string {
  const deviceStr = `device: ${paramsObj.device?.label ?? "."}`;
  const withoutDevice: Partial<T> = { ...paramsObj };
  delete withoutDevice["device"];

  const mainStr = JSON.stringify({ ...withoutDevice });
  const result = `${mainStr}; ${deviceStr}`;
  return result;
}
