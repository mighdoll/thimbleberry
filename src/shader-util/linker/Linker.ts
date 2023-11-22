/*
Parse a simple extension for wgsl that allows for linking shaders together.

#export 
#export (param1, param2, ...)
#endExport
. export includes the text of the rest of the file or until optional #end-export
. params are optional, and are globally text replaced in the export text

#import foo
#importReplace foo
#endImport
. include the imported text

*/

import { ModuleRegistry } from "./ModuleRegistry.js";
import { endImportRegex, importRegex, replaceTokens } from "./Parsing.js";

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

/** an imported module, for deduplication of imports */
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

      const text = importModule(name, registry, params, imported, lineNum, line);
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
  name: string,
  registry: ModuleRegistry,
  params: string[],
  imported: ImportModule[],
  lineNum: number,
  line: string
): string | undefined {
  const foundModule = registry.getModule(name);
  if (foundModule) {
    imported.push({ name, params });
    const importSrc = foundModule.src;
    const importText = processImportsRecursive(importSrc, registry, params, imported);
    const entries = foundModule.params.map((p, i) => [p, params[i]] as [string, string]);
    const replace = Object.fromEntries(entries);
    const patched = replaceTokens(importText, replace);
    return patched;
  } else {
    console.error(
      `#importReplace module "${name}" not found: at ${lineNum}\n>>\t${line}`
    );
  }
}
