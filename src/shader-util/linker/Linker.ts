/*
Parse a simple extension for wgsl that allows for linking shaders together.


#export 
#export (param1, param2, ...)
#endExport
. export includes the text of the rest of the file or until optional #end-export
. params are optional, and are globally text replaced in the export text

#import foo 
#import foo from myModule
#importReplace foo
#endImport
. include the imported text

#template thimb2
. apply template 'thimb2' to the exported text

#module myModule
. declare name of module 

*/

import { ModuleRegistry } from "./ModuleRegistry.js";
import { endImportRegex, importRegex, replaceTokens } from "./Parsing.js";

export interface WgslModule {
  /** name of module e.g. myPackage.myModule */
  name: string;
  exports: Export[];
  template?: string;
}

export interface Export {
  /** name of function or struct being exported */
  name: string;
  src: string;
  params: string[];
}

/** parse shader text for imports, return wgsl with all imports injected */
export function linkWgsl(src: string, registry: ModuleRegistry): string {
  return insertImportsRecursive(src, registry, [], []);
}

/** an imported module, for deduplication of imports */
interface ImportModule {
  name: string;
  params: string[];
}

function insertImportsRecursive(
  src: string,
  registry: ModuleRegistry,
  params: string[],
  imported: ImportModule[]
): string {
  const out: string[] = [];
  let importReplacing = false; // true while we're reading lines inside an importReplace

  src.split("\n").forEach((line, lineNum) => {
    const importMatch = line.match(importRegex);
    if (importMatch) {
      const groups = importMatch.groups;
      const name = groups!.name;
      const params = groups?.params?.split(",").map(p => p.trim()) ?? [];

      if (groups?.importCmd === "importReplace") {
        console.assert(
          !importReplacing,
          `#importReplace while inside #importReplace line: ${lineNum}`
        );
        importReplacing = true;
      }
      const mod = groups?.module;

      const text = importModule(name, mod, registry, params, imported, lineNum, line);
      text && out.push(text);
    } else if (importReplacing) {
      const endImport = line.match(endImportRegex);
      if (endImport) {
        importReplacing = false;
      }
    } else {
      out.push(line);
    }
  });
  return out.join("\n");
}

function importModule(
  importName: string,
  moduleName: string | undefined,
  registry: ModuleRegistry,
  params: string[],
  imported: ImportModule[],
  lineNum: number,
  line: string
): string | undefined {
  const moduleExport = registry.getModuleExport(importName, moduleName);
  if (moduleExport) {
    imported.push({ name: importName, params });
    const template = moduleExport.module.template;
    const importSrc = moduleExport.export.src;
    const importText = insertImportsRecursive(importSrc, registry, params, imported);

    const entries = moduleExport.export.params.map((p, i) => [p, params[i]]);
    const replace = Object.fromEntries(entries);
    const patched = replaceTokens(importText, replace);

    // TODO apply template

    return patched;
  } else {
    console.error(
      `#importReplace module "${importName}" not found: at ${lineNum}\n>>\t${line}`
    );
  }
}
