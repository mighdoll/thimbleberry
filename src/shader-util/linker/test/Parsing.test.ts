import { expect, test } from "vitest";
import { exportRegex, importReplaceRegex } from "../Parsing.js";

test("export regex w/o params", () => {
  const result = "// #export foo".match(exportRegex);
  expect(result?.groups?.export).toBe("foo");
});

test("export regex w/o comment prefix", () => {
  const result = "#export foo".match(exportRegex);
  expect(result?.groups?.export).toBe("foo");
});

test("parse regex with params", () => {
  const result = "// #export foo(a, b, c)".match(exportRegex);
  expect(result?.groups?.params).toBe("a, b, c");
  expect(result?.groups?.export).toBe("foo");
});

test("parse importReplace w/params", () => {
  const src = "// #importReplace reduceWorkgroup( param1, param2 )";
  const result = src.match(importReplaceRegex);
  expect(result?.groups?.params).toBe(" param1, param2 ");
  expect(result?.groups?.import).toBe("reduceWorkgroup");
});