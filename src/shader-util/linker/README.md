### wgsl-linker
wgsl-linker is a small (2kb) extension to wgsl to support wgsl modules. 
* import/export support, including import deduplication and token renaming
* pluggable template engine for parameterized modules
* optional code generated modules
* compatible with static wgsl tools like wgsl-analyzer.

#### Simple Example
Exporting a wgsl function in `randModule.wgsl`:

```
#export
fn rand() -> u32 {
  //...
}
```

Importing a wgsl function in a shader `myShader.wgsl`:

```
#import rand

fn myFn() {
  let x:u32 = rand();
}
```

Linking imports to get wgsl in `driver.ts`:

```
import rand from "./randModule.wgsl?raw";  // ?raw is vite syntax. See Build Support.
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

You can provide parameters

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

Linking and parsing happens entirely at runtime, no additional build step is required.

You can put your wgsl into strings in your typescript source if you'd like.
Or you can store your shader and shader module templates as `.wgsl` files and load
them as strings with whatever build tool you use, e.g.:

- Vite: [import ?raw](https://vitejs.dev/guide/assets#importing-asset-as-string)
- Webpack: [Source Assets](https://webpack.js.org/guides/asset-modules/).
- Rollup: [rollup-plugin-string](https://github.com/TrySound/rollup-plugin-string)

### WGSL compatible

Several features are available to support existing typechecking tools, wgsl-analyzer in particular.

#### Directives in Comments

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

#### Below the #export

`#export` will export the fn or struct definition following the `#export` line
in the module.

Source lines above the `#export` will not be copied into the importer and can be used for typechecking
the module.

Source lines below the exported fn or struct will also be copied into the importer,
but privately for use only by the module.


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

### Current Limitations and Future Work

- Export parameter replacement uses global text substitution in the module, so don't reuse
  tokens that are used as export parameters.
  A lightweight wgsl parser would help make parameter passing more precise,
  among other potential benefits.

- To enable static typechecking,
  the linker currently requires the user to manually add placeholder declarations.
  Extending wgsl-analyzer to typecheck imports would be benefit.

- A build plugin to register all relevant modules would be handy, and probably not
  difficult to build.

- Bindings and uniforms and not linked. Perhaps that will prove useful for the future.
