/** A minimal array interface for use on TypedArray types */
export interface Sliceable<T> extends ArrayLike<T> {
  [Symbol.iterator](): Iterator<T>;
  slice(start?: number, end?: number): this;
}

/** return even sized parts of an array.
 *
 * The last part may be smaller if the array is not evenly divisible by count.
 */
export function* partitionBySize<T extends Sliceable<unknown>>(
  a: T,
  count: number
): Generator<T> {
  for (let i = 0; i < a.length; ) {
    const part = a.slice(i, i + count);
    yield part;
    i += part.length;
  }
}

/** return every nth element from an array */
export function* filterNth<T>(
  a: Sliceable<T>,
  nth: number, // zero based index to select
  stride: number // 1 based stride
): Generator<T> {
  for (let i = nth; i < a.length; i += stride) {
    yield a[i];
  }
}
