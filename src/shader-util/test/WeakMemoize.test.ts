import { expect, test } from "vitest";
import { weakMemoize } from "../WeakMemoize";

test("weakMemoize", () => {
  let count = 0;
  function fn(a: number[], b: string): string[] {
    count++;
    return a.map(n => n.toString() + b);
  }
  const memo = weakMemoize(fn);
  // executes once
  expect(memo([1, 2, 3], "-foo")).toEqual(["1-foo", "2-foo", "3-foo"]);
  expect(count).toEqual(1);

  // memoization works
  expect(memo([1, 2, 3], "-foo")).toEqual(["1-foo", "2-foo", "3-foo"]);
  expect(count).toEqual(1);
});

interface Params {
  a: { label: () => string };
  b: string;
}

test("weakMemoize keyFn", () => {
  let count = 0;
  function makeKey(params: Params): string {
    return params.a.label() + params.b;
  }
  function fn(params: Params): string[] {
    count++;
    return [`-${params.b}-`];
  }

  const memo = weakMemoize(fn, { keyFn: makeKey });
  const result1 = memo({ a: { label: () => "foo" }, b: "bar" });
  expect(result1).toEqual(["-bar-"]);
  expect(count).toEqual(1);

  const result2 = memo({ a: { label: () => "foo" }, b: "bar" });
  expect(result2).toEqual(["-bar-"]);
  expect(count).toEqual(1);
});
