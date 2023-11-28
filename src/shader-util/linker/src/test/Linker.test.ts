import { expect, test } from "vitest";
import { thimbTemplate } from "../../../Template2.js";
import { CodeGenFn, linkWgsl } from "../Linker.js";
import { ModuleRegistry } from "../ModuleRegistry.js";

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

test("#import twice with different names", () => {
  const module1 = `
    #export 
    fn foo() { /* module1 */ }
  `;
  const src = `
    #import foo as bar
    #import foo as zap
    
    foo();
    zap();
  `;
  const registry = new ModuleRegistry(module1);
  const linked = linkWgsl(src, registry);
  const matches = linked.matchAll(/module1/g);
  expect([...matches].length).toBe(2);
});

test("#import snippet w/o support functions", () => {
  const module1 = `
    var logVar: u32;

    #template thimb2
    #export log(logVar, logType)
      log(logVar, "u32"); // #replace u32=logType
  `;

  const src = `
    fn foo() {
      myVar: i32 = 1;
      #import log(myVar, i32)
    }
  `;
  const registry = new ModuleRegistry(module1);
  registry.registerTemplate(thimbTemplate);
  const linked = linkWgsl(src, registry);
  expect(linked).contains('log(myVar, "i32");');
});

test("#import with different names, resolve conflicting support function", () => {
  const module1 = `
    #export 
    fn foo() { 
      support();
    }

    fn support() { }
  `;
  const src = `
    #import foo as bar
    #import foo as zap
    
    fn support() { }
    foo();
    zap();
  `;
  const registry = new ModuleRegistry(module1);
  const linked = linkWgsl(src, registry);
  const origMatch = linked.matchAll(/\bsupport\b/g);
  expect([...origMatch].length).toBe(1);
  const module1Match = linked.matchAll(/\bsupport_0\b/g);
  expect([...module1Match].length).toBe(2);
  const module2Match = linked.matchAll(/\bsupport_1\b/g);
  expect([...module2Match].length).toBe(2);
});

test("resolve conflicting import support struct imports", () => {
  const module1 = `
    #export 
    fn foo() {
      e: Elem = Elem(1); 
    }
    
    struct Elem {
      v: i32, 
    }
    
    var <workgroup> a: array<Elem, 64>;
  `;

  const src = `
     #import foo 
     #import foo as bar

     struct Elem {
       other: f32; 
     }

     foo();
     bar();
    `;
  const registry = new ModuleRegistry(module1);
  const linked = linkWgsl(src, registry);
  const origMatch = linked.matchAll(/\bElem\b/g);
  expect([...origMatch].length).toBe(1);
  const module1Match = linked.matchAll(/\bElem_0\b/g);
  expect([...module1Match].length).toBe(4);
  const module2Match = linked.matchAll(/\bElem_1\b/g);
  expect([...module2Match].length).toBe(4);
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
