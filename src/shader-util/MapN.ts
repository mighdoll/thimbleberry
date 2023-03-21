/** run a function n times returning the results in an array */
export function mapN<T = number>(n: number, fn?: (i: number) => T): T[] {
  const result = new Array(n);
  const mapFn = fn || ((i: number) => i as unknown as T);
  for (let i = 0; i < n; i++) {
    result[i] = mapFn(i);
  }
  return result;
}
