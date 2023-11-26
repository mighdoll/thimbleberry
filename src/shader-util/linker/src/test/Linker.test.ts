import { expect, test } from "vitest";
import { thimbTemplate } from "../../../Template2.js";
import { CodeGenFn, linkWgsl } from "../Linker.js";
import { ModuleRegistry } from "../ModuleRegistry.js";
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

test("read simple structexport", () => {
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

test("apply simple importReplace", () => {
  const myModule = `
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
  const registry = new ModuleRegistry(myModule);

  const linked = linkWgsl(src, registry);
  expect(linked).includes("do reduce");
  expect(linked).includes("call the imported function");
});

test("importReplace with parameter", () => {
  const myModule = `
  // these are just for typechecking the module, they're not included when the export is imported
  struct Elem {
    sum: f32,
  }
  var <workgroup> work: array<Elem, 64>; 

  // #export (work)
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
  const registry = new ModuleRegistry(myModule);

  const linked = linkWgsl(src, registry);
  expect(linked).includes("myWork[workDex]");
  expect(linked).not.includes("work[");
});

test("transitive importReplace", () => {
  const binOpModule = `
  // #export(Elem) 
  fn binaryOp(a: Elem, b: Elem) -> Elem {
      return Elem(a.sum + b.sum); // binOpImpl
  }
    `;
  const reduceModule = `
  struct MyElem {
    sum: f32,
  }
  var <workgroup> work: array<MyElem, 64>;

  #export(work)
  fn reduceWorkgroup(localId: u32) {
      let workDex = localId << 1u;
      for (var step = 1u; step < 4u; step <<= 1u) { //#replace 4=threads
          workgroupBarrier();
          if localId % step == 0u {
              work[workDex].sum = binaryOp(work[workDex], work[workDex + step]);
          }
      }
  }

  #importReplace binaryOp(MyElem)
  fn binaryOp(a: MyElem, b: MyElem) -> MyElem {}
  #endImport
  `;
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
  const registry = new ModuleRegistry(binOpModule, reduceModule);
  const linked = linkWgsl(src, registry);
  expect(linked).includes("myWork[workDex]");
  expect(linked).not.includes("work[");
  expect(linked).includes("binOpImpl");
});

test("#import w/o replace", () => {
  const myModule = `
    // #export
    fn foo() { /* fooImpl */ }
  `;

  const src = `
    // #import foo
    foo();
  `;
  const registry = new ModuleRegistry(myModule);
  const linked = linkWgsl(src, registry);
  expect(linked).includes("fooImpl");
});

test("import with template replace", () => {
  const myModule = `
    #template thimb2
    #export(threads) 
    fn foo() {
      for (var step = 0; step < 4; step++) { //#replace 4=threads
      }
    }
  `;
  const src = `
    #import foo(128)
    foo();
  `;
  const registry = new ModuleRegistry(myModule);
  registry.registerTemplate(thimbTemplate);
  const linked = linkWgsl(src, registry);
  expect(linked).includes("step < 128");
});

test("#import twice doesn't get two copies", () => {
  const module1 = `
    #export
    fn foo() { /* fooImpl */ }
  `;
  const module2 = `
    #export
    fn bar() { foo(); }

    #import foo
  `;
  const src = `
    #import bar
    #import foo

    foo();
    bar();
  `;
  const registry = new ModuleRegistry(module1, module2);
  const linked = linkWgsl(src, registry);
  const matches = linked.matchAll(/fooImpl/g);
  expect([...matches].length).toBe(1);
});

test("#import foo as bar", () => {
  const myModule = `
    #export
    fn foo() { /* fooImpl */ }
   `;

  const src = `
    #import foo as bar

    bar();
   `;
  const registry = new ModuleRegistry(myModule);
  const linked = linkWgsl(src, registry);
  expect(linked).contains("fn bar()");
});

test("#import foo from zap (multiple modules)", () => {
  const module1 = `
    // #export 
    fn foo() { /* module1 */ }
  `;
  const module2 = `
    // #export 
    fn foo() { /* module2 */ }
  `;

  const src = `
    #import foo as baz from module2

    baz();
  `;

  const registry = new ModuleRegistry();
  registry.registerOneModule(module1, "module1");
  registry.registerOneModule(module2, "module2");
  const linked = linkWgsl(src, registry);
  expect(linked).contains("/* module2 */");
});

test("#import from code generator", () => {
  function generate(params: { name: string }): string {
    return `fn foo() { /* ${params.name}Impl */ }`;
  }

  const src = `
    #import foo(bar)

    foo();
  `;
  const registry = new ModuleRegistry();
  registry.registerGenerator("foo", generate as CodeGenFn, ["name"]);
  const linked = linkWgsl(src, registry);
  expect(linked).contains("barImpl");
});

test("#import as with code generator", () => {
  function generate(params: { name: string }): string {
    return `fn foo() { /* ${params.name}Impl */ }`;
  }

  const src = `
    #import foo(bar) as baz

    baz();
  `;
  const registry = new ModuleRegistry();
  registry.registerGenerator("foo", generate as CodeGenFn, ["name"]);
  const linked = linkWgsl(src, registry);
  expect(linked).contains("fn baz()");
});

/*
TODO
 . test endExport
 . test multiple exports in a module
 . test import * 
 . test import 'as' renaming
 . test importing a function twice with different names
 . test renaming tokens to solve for multiple 
*/
