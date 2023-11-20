/*
Parse a simple extension for wgsl that allows for linking shaders together.

#export name
#export name(param1, param2, ...)
#endExport
. export is the text of the rest of the file or until optional #end-export
. params are optional, and are globally text replaced in the export text

#import foo
#importReplace foo
#endImport
. include the imported text

*/

import { ModuleRegistry } from "./ModuleRegistry.js";
import { endImportRegex, importReplaceRegex, replaceTokens } from "./ParseDirectives.js";

export interface WgslModule {
  exports: Export[];
}

export interface Export {
  name: string;
  src: string;
  params: string[];
}

/** parse shader text for imports, return wgsl with all imports injected */
export function linkWgsl(src: string, registry: ModuleRegistry): string {
  return processImportsRecursive(src, registry, [], []);
}

/** an imported module, for deduplicatio of imports */
interface ImportModule {
  name: string;
  params: string[];
}

function processImportsRecursive(
  src: string,
  registry: ModuleRegistry,
  params: string[],
  imported: ImportModule[]
): string {
  const out: string[] = [];
  let importReplacing = false; // true while we're reading lines inside an importReplace
  src.split("\n").forEach((line, lineNum) => {
    const impReplace = line.match(importReplaceRegex);
    if (impReplace) {
      console.assert(
        importReplacing === false,
        `found importReplace while parsing importReplace line: ${lineNum}`
      );
      const name = impReplace.groups!.import;
      const params = impReplace.groups?.params?.split(",").map(p => p.trim()) ?? [];
      const importModule = registry.getModule(name);
      if (!importModule) {
        console.error(
          `importReplace module not found: ${name} at ${lineNum}\n>>\t${line}`
        );
      } else {
        imported.push({ name, params });
        const importSrc = importModule.src;
        const importText = processImportsRecursive(importSrc, registry, params, imported);
        out.push(importText);
      }
      importReplacing = true;
    } else if (!importReplacing) {
      out.push(line);
    } else {
      const endImport = line.match(endImportRegex);
      if (endImport) {
        importReplacing = false;
      }
    }
  });
  return out.join("\n");
}

