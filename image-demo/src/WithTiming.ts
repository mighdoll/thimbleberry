export interface TimedResult<T> {
  result: T;
  time: number;
}

/** Utility to very roughly time an async function. 
 * 
 * Note that the measured time includes the time spent 
 * outside of the function that runs in the same event loop
 * before the Promise microtask fires. */
export async function withTimingAsync<T>(fn: () => Promise<T>): Promise<TimedResult<T>> {
  const start = performance.now();
  const result = await fn();
  const time = performance.now() - start;
  return { result, time };
}
