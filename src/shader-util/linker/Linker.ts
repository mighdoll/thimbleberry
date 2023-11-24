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

import { ModuleExport, ModuleRegistry } from "./ModuleRegistry.js";
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
  return insertImportsRecursive(src, registry, new Set());
}

function fullImportName(importName: string, moduleName: string, params: string[]): string {
  return `${moduleName}.${importName}(${params.join(",")})`
}

function insertImportsRecursive(
  src: string,
  registry: ModuleRegistry,
  imported: Set<string>
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
  imported: Set<string>,
  lineNum: number,
  line: string
): string | undefined {
  const moduleExport = getModuleExport(importName, moduleName, registry, lineNum, line);
  if (!moduleExport) {
    return undefined;
  }

  const fullImport = fullImportName(importName, moduleExport.module.name, params);
  if (imported.has(fullImport)) {
    return undefined;
  }

  imported.add(fullImport);
  const importSrc = moduleExport.export.src;
  const importText = insertImportsRecursive(importSrc, registry, imported);

  const entries = moduleExport.export.params.map((p, i) => [p, params[i]]);
  const templateParams = Object.fromEntries(entries);

  const templated = applyTemplate(importText, templateParams, moduleExport, registry);
  const patched = replaceTokens(templated, templateParams);

  return patched;
}

function getModuleExport(
  importName: string,
  moduleName: string | undefined,
  registry: ModuleRegistry,
  lineNum: number,
  line: string
): ModuleExport | undefined {
  const moduleExport = registry.getModuleExport(importName, moduleName);
  if (!moduleExport) {
    console.error(
      `#importReplace module "${importName}" not found: at ${lineNum}\n>>\t${line}`
    );
  }
  return moduleExport;
}

/** run a template processor if one is defined for this module */
function applyTemplate(
  text: string,
  templateParams: Record<string, string>,
  moduleExport: ModuleExport,
  registry: ModuleRegistry
): string {
  const template = moduleExport.module.template;
  if (template) {
    const applyTemplate = registry.getTemplate(template);
    if (applyTemplate) {
      return applyTemplate(text, templateParams);
    } else {
      console.warn(`template ${template} not registered`);
    }
  }
  return text;
}
