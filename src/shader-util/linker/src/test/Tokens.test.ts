import { test, expect} from "vitest";
import { fnDecls } from "../Tokens.js";

test.only("find all fns", () => {
  const src = `
    // comment
    fn foo () { }
    fn bar() { }
  `
  const fns = fnDecls(src);
  expect(fns).includes("foo");
  expect(fns).includes("bar");
});

