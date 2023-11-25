A small extension to wgsl to support wgsl modules, including
pluggable templating and support for dynamic code generation.

Exporting a wgsl function looks like this `randModule.wgsl`:

```
#export
fn rand() -> u32 {
}
```

Importing a wgsl function looks like this `myShader.wgsl`:

```
#import rand

fn myFn() {
  let x:u32 = rand();
}
```

Linking works like this:

```
import rand from "./randModule.wgsl?raw";  // (?raw is vite syntax)
import myShader from "./myShader.wgsl?raw";

// register the linkable modules
const registry = new ModuleRegistry(rand);

// link my shader with any imported modules, producing wgsl
const code = linkWgsl(myShader, registry);

// then you can pass the wgsl string to WebGPU
device.createShaderModule({ code });
```

### Export details

#### Export Parameters

```
#export
#export (param1, param2, ...)
#endExport
. params are optional: the linker will globally string replace param names found in
  the export text with the corresponding params provided by the importer
. if N params are present in the export declaration, importers must provide N params
```

### Module Naming

```
#module myModule
. declare name of module
```

#### What Is Exported?

`#export` will export the fn or struct definition following the `#export` line
in the module's wgsl text.
Source lines above the `#export` will not be copied into the importer.
Source lines below the `#export` up the next `#export` or `#endExport` directive will
be copied into the importer.

```
// The lines above the #export can be used for statically typechecking the module, they won't be exported
struct Elem { }
var <workgroup> workArray: array<Elem, 1>;

// The 'fill' fn will be copied to the importer
#export (workArray, Elem, workSize)
fn fill(elem: Elem) {
  for (let i = 0; i < workSize; i++) {
    setElem(i, elem);
  }
}

// The 'setElem' fn will also be copied to the importer, but privately. 
fn setElem(i: i32, elem: Elem) {
   workArray[i] = elem;
}
```

### Import details

```
#import foo
#import foo from myModule


```

### Custom Templates

```
#template thimb2
. use template 'thimb2' to the exported text
```

### Code Generators

### Build Support

Linking and parsing happens entirely at runtime in the current version.
The library is about 2kb.

You can put your wgsl into strings in your typescript source if you'd like.
Or you can store your shader and shader module templates as `.wgsl` files and load
them as strings with whatever build tool you use, e.g.:

- Vite: [import ?raw](https://vitejs.dev/guide/assets#importing-asset-as-string)
- Webpack: [Source Assets](https://webpack.js.org/guides/asset-modules/).
- Rollup: [rollup-plugin-string](https://github.com/TrySound/rollup-plugin-string)

### WGSL compatible

The extensions may be placed inside comments, so that tools like wgsl-analyzer that process
raw wgsl continue to operate.

```
// #import rand
```

To support static typechecking
there's a variant of import called importReplace that allows
listing a statically typecheckable stub that will be replaced by linking.

```
// #importReplace rand(u32) as random
fn random()->u32 {}
// #endImport
```

Eventually, it'd be nice to add #import support to typechecking tools like wgsl-analzyer.
