import { expect, test } from "vitest";
import { applyTemplate } from "../Template";

test("applyTemplate simple", () => {
  const wgsl = `var a = 1u; //! 1=blockSize `;
  const applied = applyTemplate(wgsl, { blockSize: "2" });
  expect(applied).toEqual("var a = 2u; // blockSize");
});

test("template applies from right", () => {
  const wgsl = `var a1 = 1u; //! 1=blockSize `;
  const applied = applyTemplate(wgsl, { blockSize: "2" });
  expect(applied).toEqual("var a1 = 2u; // blockSize");
});

test("applyTemplate two rules", () => {
  const wgsl = `@workgroup_size(2, 2, 1) //! 2=workgroupSize 2=workgroupSize`;
  const applied = applyTemplate(wgsl, { workgroupSize: "4" });
  expect(applied).toEqual("@workgroup_size(4, 4, 1) // workgroupSize workgroupSize");
});

test("applyTemplate find with spaces", () => {
  const wgsl = `return a + b; //! "return a + b;"=join`;
  const max = "return max(a, b);";
  const applied = applyTemplate(wgsl, { join: max });
  const expected = `${max} // join`;

  expect(applied).toEqual(expected);
});

test("replace with value instead of key", () => {
  const wgsl = `<storage, read_write>; //! read_write="write"`;
  const applied = applyTemplate(wgsl, {});

  expect(applied).toEqual("<storage, write>; // write");
});

test("template if test undefined disables a line", () => {
  const wgsl = `} //! IF not_defined`;
  const applied = applyTemplate(wgsl, {});
  expect(applied).toEqual("");
});

test("template if false test disables a line", () => {
  const wgsl = `} //! IF condition`;
  const applied = applyTemplate(wgsl, { condition: false });
  expect(applied).toEqual("");
});

test("template if test enables a line", () => {
  const wgsl = `} //! if defined`;
  const applied = applyTemplate(wgsl, { defined: true });
  expect(applied).toEqual("} ");
});

test("apply two rules, 2nd matches first", () => {
  const wgsl = `(texel: vec4<f32>) -> vec4<f32> { //! f32=srcType f32=destType`;
  const applied = applyTemplate(wgsl, { srcType: "u32", destType: "f32" });
  expect(applied).toEqual("(texel: vec4<u32>) -> vec4<f32> { // srcType destType");
});

test("template if! test disables a line", () => {
  const wgsl = `} //! if !defined`;
  const applied = applyTemplate(wgsl, { defined: true });
  expect(applied).toEqual("");
});

test("template if! test enables a line", () => {
  const wgsl = `} //! if !defined`;
  const applied = applyTemplate(wgsl, {});
  expect(applied).toEqual("} ");
});

test("template two if tests, one negative", () => {
  const wgsl = `} //! if defined if notDefined`;
  const applied = applyTemplate(wgsl, { defined: true });
  expect(applied).toEqual("");
});

test("template two if tests, both positive", () => {
  const wgsl = `} //! if defined if defined2`;
  const applied = applyTemplate(wgsl, { defined: true, defined2: true });
  expect(applied).toEqual("} ");
});

test("template two if! tests, one postive, disable ", () => {
  const wgsl = `} //! if !defined if !defined2`;
  const applied = applyTemplate(wgsl, {defined2: true});
  expect(applied).toEqual("");
});