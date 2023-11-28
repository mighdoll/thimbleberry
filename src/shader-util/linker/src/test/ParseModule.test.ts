import { expect, test } from "vitest";
import { parseModule } from "../ParseModule.js";

test("read simple fn export", () => {
  const exportPrefix = `// #export`;
  const src = `
    fn one() -> i32 {
      return 1;
    }
  `;
  const module = parseModule(exportPrefix + "\n" + src);
  expect(module.exports.length).toBe(1);
  const firstExport = module.exports[0];
  expect(firstExport.name).toBe("one");
  expect(firstExport.params).deep.equals([]);
  expect(firstExport.src).toBe(src);
});

test("read simple struct export", () => {
  const exportPrefix = `// #export`;
  const src = `
    struct Elem {
      sum: f32;
    }
  `;
  const module = parseModule(exportPrefix + "\n" + src);
  expect(module.exports.length).toBe(1);
  const firstExport = module.exports[0];
  expect(firstExport.name).toBe("Elem");
  expect(firstExport.params).deep.equals([]);
  expect(firstExport.src).toBe(src);
});

test("read #module", () => {
  const myModule = `
    // #module myModule
    // #export 
    fn foo() {}
  `;
  const textModule = parseModule(myModule);
  expect(textModule.name).toBe("myModule");
});


test("parse #export log", () => {
  const myModule = `
    #export log(myVar)

    _log(myVar)
  `;
  const textModule = parseModule(myModule);
  expect(textModule.exports[0].name).toBe("log");
});