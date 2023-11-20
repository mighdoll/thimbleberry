import { expect, test } from "vitest";
import { exportRegex, importReplaceRegex, parseExports } from "../Linker.js";

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
  const results = parseExports(exportPrefix + src);
  expect(results.length).toBe(1);
  const result = results[0];
  expect(result.name).toBe("binaryOp");
  expect(result.params).deep.equals(["Elem"]);
  expect(result.src).toBe(src);
});

test("parse simple importReplace", () => {
  const src = "// #importReplace reduce-workgroup( param1, param2 )";
  const result = src.match(importReplaceRegex);
  expect(result?.groups?.params).toBe(" param1, param2 ");
  expect(result?.groups?.export).toBe("reduce-workgroup");
});

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
