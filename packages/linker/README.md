## wgsl-linker

Features include:

- import / export support in wgsl (including import deduplication and token renaming)
- dynamic exports via pluggable template engines, or code generation functions
- compatible with static wgsl tools like code formatters and wgsl-analyzer
- supports #if #else #endif, and #replace
- small (about 3kb). Link at runtime, no build step required.

#### Simple Example

Exporting a wgsl function in `randModule.wgsl`:

```
#export
fn rand() -> u32 { /* ... */ }
```

Importing a wgsl function `myShader.wgsl`:

```
#import rand

fn myFn() {
  let x:u32 = rand();
}
```

Load wgsl strings, and then link them together in `myDriver.ts`:

```
import randWgsl from "./randModule.wgsl?raw";  // ?raw is vite syntax. See Build Support.
import myShaderWgsl from "./myShader.wgsl?raw";

const registry = new ModuleRegistry(randWgsl); // register the linkable exports
const code = linkWgsl(myShaderWgsl, registry); // merge any imported text
device.createShaderModule({ code });           // pass the wgsl string to WebGPU
```

### Main API

`new ModuleRegistry(wgslFragment1, wgslFragment2)` register wgsl modules for imports to use.

`linkWgsl(src, registry, params?)` merge any imported wgsl fragments into src with optional dynamic parameters.

#### Advanced features
`registry.registerTemplate()` register a template function for transforming text.

`registry.registerGenerator(name, fn, params?, moduleName?)` register a code generation function
that can be imported.

### Syntax

#### Export

`#export` export the following text, name will be the following fn or struct.

`#export name` export the following text with the provided name.

`#endInsert` text between the `#export` and `#endInsert` will be imported at the location
of the `#import`. Text below the `#endInsert` will be exported and inserted at the root level 
(at the bottom of the text).

`#endExport` end an `#export` section.

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

1. apply templates if any then string replace import/export parameters. 

    (alternately, run a code generation function to generate the text)

1. rewrite the export for 'as newName' is 
1. rename support functions or structs (and their references) to avoid name conflicts. 
1. recursively import any imports in the imported text
1. insert tranformed import code at #import location 
(and add any root level import text at the bottom).


### Custom Code Generation
An export can be customized by the importing code:
1. **`#export` parameters** export parameters are replaced with the corresponding `#import` parameters in the exported text. Useful e.g. to map types to the importer's environment.

Users can also provide runtime parameters to `linkWgsl` for templates or code generation.
1. **template parameters** exports can specify a template engine to process their text 
via the `#template` directive. 

    The available `replacer` engine processes `#replace` directives to find and replace text on a line with dynamic variables.
1. **code generation functions** `#import`s can be fulfilled by javascript/typescript 
functions that generate wgsl.
Just register a function with the `ModuleRegistry` along with a name so that it can be `#import`ed.

The `#import` syntax is the same for all types of exports, 
so the developer of exports can switch transparently between different generation techniques
without requiring the importer to make any changes.

#### Support for Static WGSL Tools.

`// #<directive>` all directives may be placed inside comments
so wgsl code formatters and other tools won't get confused.

`#if typecheck 
fn foo(){} 
#endif` place static declarations in an `#if <false>` clause. The declarations will be visible to static wgsl typecheckers during development, and safely removed at runtime.


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

- It'd be fun to publishing wgsl modules as esm modules aka glslify.

- Bindings, global variables, and consts can be imported, but are not rewritten to avoid conflicts.
  Perhaps in a future version.
