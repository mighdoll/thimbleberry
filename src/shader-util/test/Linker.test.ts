import { expect, test } from "vitest";
import {
  ModuleRegistry,
  exportRegex,
  importReplaceRegex,
  linkWgsl,
  parseModule,
} from "../Linker.js";

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

test("read simple export", () => {
  const exportPrefix = `// #export binaryOp(Elem)\n`;
  const src = `
    struct Elem { 
        sum: f32,  
    }
  `;
  const module = parseModule(exportPrefix + src);
  expect(module.exports.length).toBe(1);
  const result = module.exports[0];
  expect(result.name).toBe("binaryOp");
  expect(result.params).deep.equals(["Elem"]);
  expect(result.src).toBe(src);
});

test.only("parse importReplace w/params", () => {
  const src = "// #importReplace reduceWorkgroup( param1, param2 )";
  const result = src.match(importReplaceRegex);
  expect(result?.groups?.params).toBe(" param1, param2 ");
  expect(result?.groups?.import).toBe("reduceWorkgroup");
});

test("apply simple importReplace", () => {
  const module = `
  // #export reduceWorkgroup
  fn reduceWorkgroup(localId: u32) {
    // do reduce
  }
  `;

  const src = `
    // #importReplace reduceWorkgroup
    fn reduceWorkgroup(localId: u32) {} 
    // #endImport
    reduceWorkgroup(localId); // call the imported function
  `;
  const registry = new ModuleRegistry();
  registry.registerModule(module);

  const linked = linkWgsl(src, registry);
  expect(linked).includes("do reduce");
  expect(linked).includes("call the imported function");
});

/*
TODO
 . 
 . test importReplace with parameters
 . test transitive imports
 . test code gen import via template
*/
/*
// #importReplace reduce-workgroup(work, Output, workgroupThreads)
fn reduceWorkgroup(localId: u32) {} 
// #end
*/

/*
// #importReplace binaryOp(Elem)
struct Elem { }
fn binaryOp(a: Elem, b: Elem) -> Elem {}
// #importEnd

*/
