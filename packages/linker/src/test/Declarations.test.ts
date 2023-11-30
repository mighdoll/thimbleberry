import { test, expect } from "vitest";
import { fnDecls, replaceFnCalls, structDecls } from "../Declarations.js";

test("find all fn declarations", () => {
  const src = `
    // comment
    fn foo () { }
    fn bar() { }
  `;
  const fns = fnDecls(src);
  expect(fns).includes("foo");
  expect(fns).includes("bar");
});

test("find all struct declarations", () => {
  const src = `
    struct Foo { }
    /* */struct Bar
    { 

    }
  `;
  const fns = structDecls(src);
  expect(fns).includes("Foo");
  expect(fns).includes("Bar");
});

test("replace fn call", () => {
  const src = `
    fn foo() { }

    foo();
  `;
  const result = replaceFnCalls(src, "foo", "bar");
  expect(result).contains("bar()");
  expect(result).contains("fn foo()");
});

test("replace fn calls doesn't catch @", () => {
  const src = `
    fn diagnostic() { }

    @diagnostic(off)
    diagnostic();
  `;
  const result = replaceFnCalls(src, "diagnostic", "foo");
  expect(result).contains("@diagnostic(off)");
  expect(result).contains("foo()");
});
