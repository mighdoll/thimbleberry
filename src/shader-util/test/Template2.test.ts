import { expect, test } from "vitest";
import {
  applyTemplate,
  keyValuesRegex,
  parseReplaceDirective,
  replaceRegex,
  scan,
} from "../Template2.js";

test("#replace regex", () => {
  const result = `//#replace 4=threads`.match(replaceRegex);
  expect(result?.groups?.replaces).toBe("4=threads");
});

test("key value pairs regex", () => {
  const result = `4=threads 8=foo`.match(keyValuesRegex);
  expect(result).deep.equals(["4=threads", "8=foo"]);
});

test("replaceDirective", () => {
  const result = parseReplaceDirective(`// #replace 4=threads "quoted str"=foo`)!;
  const { replaceKeys, bareLine } = result;
  expect(replaceKeys).to.deep.equal({ 4: "threads", "quoted str": "foo" });
  expect(bareLine).to.equal("// ");
});

test("scan", () => {
  const result = scan([1, 2, 1], (a, b: string) => b.slice(a), "foobar");
  expect(result).deep.equals(["oobar", "bar", "ar"]);
});

test("simple #replace", () => {
  const src = `for (var step = 1u; step < 4u; step <<= 1u) { //#replace 4=threads`;
  const tbd = `for (var step = 1u; step < 8u; step <<= 1u) { //`;
  const result = applyTemplate(src, { threads: 8 });
  expect(result).equals(tbd);
});

test("couble #replace", () => {
  const src = `for (var x=4; x < 8; x++) { //#replace 4=start 8=end`;
  const tbd = `for (var x=128; x < 256; x++) { //`;
  const result = applyTemplate(src, { start: 128, end: 256});
  expect(result).equals(tbd);
});
