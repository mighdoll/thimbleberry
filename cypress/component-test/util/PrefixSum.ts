export function prefixSum(src: number[]): number[] {
  let prev = 0;

  return src.map((a) => {
    const result = a + prev;
    prev = result;
    return result;
  });
}
