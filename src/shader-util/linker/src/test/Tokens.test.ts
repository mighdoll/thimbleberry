import { test, expect} from "vitest";
import { fnDecls, structDecls } from "../Tokens.js";

test("find all fn declarations", () => {
  const src = `
    // comment
    fn foo () { }
    fn bar() { }
  `
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
  `
  const fns = structDecls(src);
  expect(fns).includes("Foo");
  expect(fns).includes("Bar");
});