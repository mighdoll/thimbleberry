import { expect, test } from "vitest";
import { promiseDelay } from "../PromiseDelay";
import { trackContext, trackUse, withAsyncUsage, withUsage } from "../TrackUse";

test("withUsage", () => {
  const counter = destroyCounter();
  withUsage(() => {
    trackUse(counter);
  });
  expect(counter.count).toBe(1);
});

test("withAsyncUsage", async () => {
  const counter = destroyCounter();
  await withAsyncUsage(async () => {
    await promiseDelay();
    trackUse(counter);
  });

  expect(counter.count).toBe(1);
});

test("nested withUsage", () => {
  const counter = destroyCounter();
  withUsage(() => {
    trackUse(counter);
    withUsage(() => {
      trackUse(counter);
    });
  });

  expect(counter.count).toBe(1);
});

test("overlapping contexts", () => {
  const counter = destroyCounter();
  const context1 = trackContext();
  trackUse(counter, context1);
  const context2 = trackContext();
  trackUse(counter, context2);
  context1.finish();
  expect(counter.count).toEqual(0);
  context2.finish();
  expect(counter.count).toEqual(1);
});

interface DestroyCounter {
  destroy(): void;
  count: number;
}

function destroyCounter(): DestroyCounter {
  const tracker = {
    destroy: () => {
      tracker.count++;
    },
    count: 0
  };
  return tracker;
}
