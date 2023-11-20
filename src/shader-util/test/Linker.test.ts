import { expect, test } from "vitest";
import { linkWgsl } from "../linker/Linker.js";
import { ModuleRegistry, parseModule } from "../linker/ModuleRegistry.js";
import { replaceTokens } from "../linker/Parsing.js";

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

test("apply simple importReplace", () => {
  const module = `
  // #export reduceWorkgroup
  fn reduceWorkgroup(localId: u32) {
    // do reduce
  }`;

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

test("replaceTokens", () => {
  const src = `
  fn foo() {};
  fn bar() {
    let x = foo() + 1;
  }
`;
  const replaced = replaceTokens(src, { foo: "fez" });
  console.log(replaced);
});

test("importReplace with parameters", () => {
  const module = `
  // these are just for typechecking the module, they're not included when the export is imported
  struct Elem {
    sum: f32,
  }
  var <workgroup> work: array<Elem, 64>; 

  // #export reduceWorkgroup(work, Elem, threads)
  fn reduceWorkgroup(localId: u32) {
      let workDex = localId << 1u;
      for (var step = 1u; step < 4u; step <<= 1u) { //#replace 4=threads
          workgroupBarrier();
          if localId % step == 0u {
              work[workDex].sum = work[workDex].sum + work[workDex + step].sum);
          }
      }
  }`;

  const src = `
    struct MyElem {
      sum: u32;
    }
    var <workgroup> myWork: array<MyElem, 128>; 

    // #importReplace reduceWorkgroup(myWork, MyElem)
    fn reduceWorkgroup(localId: u32) {} 
    // #endImport

    reduceWorkgroup(localId); // call the imported function
  `;
  const registry = new ModuleRegistry();
  registry.registerModule(module);

  const linked = linkWgsl(src, registry);
  console.log(linked);
  expect(linked).includes("myWork[workDex]");
});

/*
TODO
 . 
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
