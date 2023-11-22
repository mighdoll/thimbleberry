import { expect, test } from "vitest";
import { linkWgsl } from "../Linker.js";
import { ModuleRegistry, parseModule } from "../ModuleRegistry.js";

test("read simple fn export", () => {
  const exportPrefix = `// #export`;
  const src = `
    fn one() -> i32 {
      return 1;
    }
  `;
  const module = parseModule(exportPrefix + "\n" + src);
  expect(module.exports.length).toBe(1);
  const result = module.exports[0];
  expect(result.name).toBe("one");
  expect(result.params).deep.equals([]);
  expect(result.src).toBe(src);
});

test.only("read simple structexport", () => {
  const exportPrefix = `// #export`;
  const src = `
    struct Elem {
      sum: f32;
    }
  `;
  const module = parseModule(exportPrefix + "\n" + src);
  expect(module.exports.length).toBe(1);
  const result = module.exports[0];
  expect(result.name).toBe("Elem");
  expect(result.params).deep.equals([]);
  expect(result.src).toBe(src);
});

test("apply simple importReplace", () => {
  const module = `
  // #export
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

test("importReplace with parameter", () => {
  const module = `
  // these are just for typechecking the module, they're not included when the export is imported
  struct Elem {
    sum: f32,
  }
  var <workgroup> work: array<Elem, 64>; 

  // #export reduceWorkgroup(work)
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

    // #importReplace reduceWorkgroup(myWork)
    fn reduceWorkgroup(localId: u32) {} 
    // #endImport

    reduceWorkgroup(localId); // call the imported function
  `;
  const registry = new ModuleRegistry();
  registry.registerModule(module);

  const linked = linkWgsl(src, registry);
  expect(linked).includes("myWork[workDex]");
  expect(linked).not.includes("work[");
});

test("transitive importReplace", () => {
  //   const binOpModule = `
  // // #export BinaryOp(Elem, InputElem, texelType)
  //   #
  // fn binaryOp(a: Elem, b: Elem) -> Elem {
  //     return Elem(a.sum + b.sum);
  // }
  //   `;
  // const reduceModule = `
  // // these are just for typechecking the module, they're not included when the export is imported
  // struct Elem {
  //   sum: f32,
  // }
  // var <workgroup> work: array<Elem, 64>;
  // // #export reduceWorkgroup(work)
  // fn reduceWorkgroup(localId: u32) {
  //     let workDex = localId << 1u;
  //     for (var step = 1u; step < 4u; step <<= 1u) { //#replace 4=threads
  //         workgroupBarrier();
  //         if localId % step == 0u {
  //             work[workDex].sum = work[workDex].sum + work[workDex + step].sum);
  //         }
  //     }
  // }`;
  // const src = `
  //   struct MyElem {
  //     sum: u32;
  //   }
  //   var <workgroup> myWork: array<MyElem, 128>;
  //   // #importReplace reduceWorkgroup(myWork)
  //   fn reduceWorkgroup(localId: u32) {}
  //   // #endImport
  //   reduceWorkgroup(localId); // call the imported function
  // `;
  // const registry = new ModuleRegistry();
  // // registry.registerModule(module);
});

/*
TODO
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
