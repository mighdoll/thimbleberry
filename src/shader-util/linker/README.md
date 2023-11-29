## wgsl-linker

Features include:

- import / export support in wgsl, including import deduplication and token renaming
- parameterize exports via pluggable templating or code generation
- compatible with static wgsl tools like code formatters and wgsl-analyzer
- small (about 3kb)

#### Simple Example

Exporting a wgsl function in `randModule.wgsl`:

```
#export
fn rand() -> u32 {
  /* ... */
}
```

Importing a wgsl function in a shader `myShader.wgsl`:

```
#import rand

fn myFn() {
  let x:u32 = rand();
}
```

Linking imports to get wgsl in `myDriver.ts`:

```
import rand from "./randModule.wgsl?raw";  // ?raw is vite syntax. See Build Support.
import myShader from "./myShader.wgsl?raw";

const registry = new ModuleRegistry(rand); // register the linkable exports
const code = linkWgsl(myShader, registry); // merge any imported text
device.createShaderModule({ code });       // pass the wgsl string to WebGPU
```

### Main API

`linkWgsl(src, registry)` merge any imports into src.

`new ModuleRegistry(wgslFragment1, wgslFragment2)` register wgsl modules for imports to use.

`registry.registerTemplate()` register a template function for transforming text.

`registry.registerGenerator(name, fn, params?, moduleName?)` register a code generation function
that can be imported.


### Syntax

#### Export

`#export` export the following text, name will be the following fn or struct.

`#export name` export the following text with the provided name.

`#endInsert` text between the `#export` and `#endInsert` will be imported at the location
of the `#import`. Text below the `#endInsert` will be inserted at the root level 
(at the bottom of the text).

`#export (param1, param2, ...)` optional parameters to customize exported text.
The linker will globally string replace params in the exported text
with params provided by the importer.

`#template name` specify a template function for additional processing
of exported text in this module.
The template function is passed any import parameters,
and runs prior to #export parameter string replacement.

`#module myModule` declare name of module.

#### Import

`#import name` import code, selected by export name.

`#import name from moduleName` import code, selected by module and export name.

`#import name <from moduleName> as rename` rewrite the imported fn or struct to a new name.

`#import name (arg1, arg2) <from moduleName> <as rename>` pass parameters to
match export parameters.

Imported text is transformed as follows:

1. apply templates if any and string replace import/export parameters 
  (or run code generation function)
1. rewrite the export named if 'as newName' is provided
1. rename support functions or structs (and their references) to avoid name conflicts. 
1. recursively import any imports in the imported text
1. insert tranformed import code at #import location 
(and add any root level import text at the bottom).



#### Support for Static WGSL Tools.

`// #<directive>` all directives may be placed inside comments
so wgsl code formatters and other tools won't get confused.

`// #importReplace name` a variant of import to support static typechecking.
The following text will be visible to static typechecking, but will
be replaced with the dynamically generated import by the linker.

`// #endImport` end the importReplace.

- example:
  ```
  // #importReplace rand(u32) as random
  fn random()->u32 {} // static declaration for typechecking
  // #endImport
  ```

### #export sections

Source lines above the `#export` will not be copied into the importer and can be used for typechecking
the module.

`#export` will export the fn or struct definition following the `#export` line
in the module.

Source lines below the exported fn or struct will also be copied into the importer,
but privately for use only by the module.

```
// The lines above the #export can be used for statically typechecking the module
// (they won't be exported)
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


### Build Support

Linking and parsing happens entirely at runtime, no additional build step is required.

You can put your wgsl into strings in your typescript source if you'd like.
Or you can store your shader and shader module templates as `.wgsl` files and load
them as strings with whatever build tool you use, e.g.:

- Vite: [import ?raw](https://vitejs.dev/guide/assets#importing-asset-as-string)
- Webpack: [Source Assets](https://webpack.js.org/guides/asset-modules/).
- Rollup: [rollup-plugin-string](https://github.com/TrySound/rollup-plugin-string)

### Current Limitations and Future Work

- Export parameter replacement and fn/struct renaming use global text substitution
  in the module, so best not to alias tokens that are used as export parameters 
  or function names. In the future, replacing text searching with a lightweight 
  wgsl parser should help.

- To enable static typechecking,
  currently the importer needs to manually add placeholder declarations.
  Extending wgsl-analyzer to typecheck imports would be better, these declarations
  should be provided by the exporter.

- A build plugin to register all relevant module files would be handy.

- Publishing wgsl modules as esm modules aka glslify.

- Bindings, global variables, and consts can be imported, but are not rewritten.
  Perhaps in a future version.
