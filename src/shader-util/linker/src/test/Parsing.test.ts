import { expect, test } from "vitest";
import {
  exportRegex,
  fnOrStructRegex,
  fnRegex,
  importRegex,
  templateRegex,
} from "../Parsing.js";
import { replaceTokens } from "../Declarations.js";

test("export regex w/o params", () => {
  const result = "// #export".match(exportRegex);
  expect(result).not.toBeNull();
});

test("export regex w/o comment prefix", () => {
  const result = "#export".match(exportRegex);
  expect(result).not.toBeNull();
});

test("export regex with params", () => {
  const result = "// #export(a, b, c)".match(exportRegex);
  expect(result?.groups?.params).toBe("a, b, c");
});

test("template regex", () => {
  const matched = "// #template foo".match(templateRegex);
  expect(matched?.groups?.name).toBe("foo");
});

test("import regex w/params", () => {
  const src = "// #importReplace reduceWorkgroup( param1, param2 )";
  const result = src.match(importRegex);
  expect(result?.groups?.params).toBe(" param1, param2 ");
  expect(result?.groups?.name).toBe("reduceWorkgroup");
  expect(result?.groups?.importCmd).toBe("importReplace");
});

test("import regex #import", () => {
  const matches = "// #import foo".match(importRegex);
  expect(matches?.groups?.name).toBe("foo");
  expect(matches?.groups?.importCmd).toBe("import");
});

test("#import foo as bar", () => {
  const matches = "// #import foo as bar".match(importRegex);
  expect(matches?.groups?.name).toBe("foo");
  expect(matches?.groups?.importCmd).toBe("import");
  expect(matches?.groups?.importAs).toBe("bar");
});

test("#import foo(a,b,c) as bar", () => {
  const matches = "// #import foo(a,b,c) as bar".match(importRegex);
  expect(matches?.groups?.name).toBe("foo");
  expect(matches?.groups?.importCmd).toBe("import");
  expect(matches?.groups?.params).toBe("a,b,c");
  expect(matches?.groups?.importAs).toBe("bar");
});

test("#importReplace foo(1,2,3) from zap", () => {
  const matches = "#importReplace foo(1,2,3) from zap".match(importRegex);
  expect(matches?.groups?.name).toBe("foo");
  expect(matches?.groups?.importCmd).toBe("importReplace");
  expect(matches?.groups?.importFrom).toBe("zap");
  expect(matches?.groups?.params).toBe("1,2,3");
});

test("#import foo as bar from zap", () => {
  const matches = "// #import foo as bar from zap".match(importRegex);
  expect(matches?.groups?.name).toBe("foo");
  expect(matches?.groups?.importCmd).toBe("import");
  expect(matches?.groups?.importAs).toBe("bar");
  expect(matches?.groups?.importFrom).toBe("zap");
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

test("find fn decl", () => {
  const src = `
    // comment
    fn foo() { }
  `
  const matches = src.match(fnRegex);
  expect(matches?.groups?.name).toBe("foo");
});

test("find fn decl across two lines", () => {
  const src = `
    // comment
    fn foo
    () { }
  `
  const matches = src.match(fnRegex);
  expect(matches?.groups?.name).toBe("foo");
});
