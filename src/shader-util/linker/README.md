A small extension to wgsl to support modularization and dynamic code generation.


Importing a function looks like this:

#import foo from 

#export 
#export (param1, param2, ...)
#endExport
. export includes the text of the rest of the file or until optional #end-export
. params are optional: the linker will globally string replace param names found in 
  the export text with the corresponding params provided by the importer
. if N params are present in the export declaration, importers must provide N params

#import foo 
#import foo from myModule
#importReplace foo
#endImport
. include the imported text

#template thimb2
. apply template 'thimb2' to the exported text

#module myModule
. declare name of module 


### Build Support

Linking and parsing happens entirely at runtime in the current version. 
The library is small.

You can put your wgsl into strings in your typescript source if you'd like.
Or you can store your shader and shader module templates as `.wgsl` files and load
them as strings with whatever build tool you use, e.g.: 
* Vite: [import ?raw](https://vitejs.dev/guide/assets#importing-asset-as-string)
* Webpack: [Source Assets](https://webpack.js.org/guides/asset-modules/).
* Rollup: [rollup-plugin-string](https://github.com/TrySound/rollup-plugin-string)

