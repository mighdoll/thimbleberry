import { expect, test } from "vitest";
import { filterNth, partitionBySize } from "../Sliceable";

test("partitionBySize", () => {
  const a = [1, 2, 3, 4, 5];
  const parts = [...partitionBySize(a, 2)];
  expect(parts).toEqual([[1, 2], [3, 4], [5]]);
});

test("filterNth", () => {
  const a = [1, 2, 3, 4];
  const filtered = [...filterNth(a, 1, 2)];
  expect(filtered).toEqual([2, 4]);
});
