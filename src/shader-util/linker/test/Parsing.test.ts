import { expect, test } from "vitest";
import { exportRegex, fnOrStructRegex, importRegex, replaceTokens } from "../Parsing.js";

test("export regex w/o params", () => {
  const result = "// #export".match(exportRegex);
  expect(result).not.toBeNull();
});

test("export regex w/o comment prefix", () => {
  const result = "#export".match(exportRegex);
  expect(result).not.toBeNull();
});

test("parse regex with params", () => {
  const result = "// #export(a, b, c)".match(exportRegex);
  expect(result?.groups?.params).toBe("a, b, c");
});

test("parse importReplace w/params", () => {
  const src = "// #importReplace reduceWorkgroup( param1, param2 )";
  const result = src.match(importRegex);
  expect(result?.groups?.params).toBe(" param1, param2 ");
  expect(result?.groups?.name).toBe("reduceWorkgroup");
  expect(result?.groups?.importCmd).toBe("importReplace");
});

test("parse #import", () => {
  const matches = "// #import foo".match(importRegex);
  expect(matches?.groups?.name).toBe("foo");
  expect(matches?.groups?.importCmd).toBe("import");
});

test("replaceTokens", () => {
  const src = `
  fn foo() {};
  fn bar() {
    let x = foo() + 1;
  }
`;
  const replaced = replaceTokens(src, { foo: "fez" });
  expect(replaced).includes("fez");
  expect(replaced).not.includes("foo");
});

test("parse fn", () => {
  const result = "fn foo(".match(fnOrStructRegex);
  expect(result?.groups?.name).toBe("foo");
});

test("parse struct", () => {
  const result = "struct Bar {".match(fnOrStructRegex);
  expect(result?.groups?.name).toBe("Bar");
});
