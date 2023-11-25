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

export interface ModuleBase {
  /** name of module e.g. myPackage.myModule */
  name: string;
  exports: Export[];
}

export type WgslModule = TextModule | GeneratorModule;

export interface TextModule extends ModuleBase {
  template?: string;
  exports: TextExport[];
}

export interface GeneratorModule extends ModuleBase {
  exports: GeneratorExport[];
}

export type Export = TextExport | GeneratorExport;

interface ExportBase {
  /** name of function or struct being exported */
  name: string;
  params: string[];
}

export interface TextExport extends ExportBase {
  src: string;
}

export interface GeneratorExport extends ExportBase {
  generate: (params: Record<string, string>) => string;
}

/** parse shader text for imports, return wgsl with all imports injected */
export function linkWgsl(src: string, registry: ModuleRegistry): string {
  return insertImportsRecursive(src, registry, new Set());
}

function fullImportName(
  importName: string,
  moduleName: string,
  params: string[]
): string {
  return `${moduleName}.${importName}(${params.join(",")})`;
}

/** process source text by finding #import directives and inserting the imported module text */
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
  const moduleExport = registry.getModuleExport(importName, moduleName);
  if (!moduleExport) {
    console.error(
      `#importReplace module "${importName}" not found: at ${lineNum}\n>>\t${line}`
    );
    return undefined;
  }

  const fullImport = fullImportName(importName, moduleExport.module.name, params);
  if (imported.has(fullImport)) {
    return undefined;
  }

  imported.add(fullImport);

  const entries = moduleExport.export.params.map((p, i) => [p, params[i]]);
  const paramsRecord = Object.fromEntries(entries);

  if (moduleExport.kind === "text") {
    const template = moduleExport.module.template;
    return importText(moduleExport.export, template, registry, paramsRecord, imported);
  } else if (moduleExport.kind === "function") {
    return importGenerator(moduleExport.export, registry, paramsRecord, imported);
  } else {
    console.error(`unexpected module export: ${JSON.stringify(moduleExport, null, 2)}`);
  }
}

function importText(
  textExport: TextExport,
  template: string | undefined,
  registry: ModuleRegistry,
  paramsRecord: Record<string, string>,
  imported: Set<string>
): string {
  const importSrc = textExport.src;
  const importText = insertImportsRecursive(importSrc, registry, imported);

  const templated = applyTemplate(importText, paramsRecord, template, registry);
  const patched = replaceTokens(templated, paramsRecord);

  return patched;
}

function importGenerator(
  generatorExport: GeneratorExport,
  registry: ModuleRegistry,
  paramsRecord: Record<string, string>,
  imported: Set<string>
): string {
  const generated = generatorExport.generate(paramsRecord);
  const importText = insertImportsRecursive(generated, registry, imported);
  return importText;
}

/** run a template processor if one is defined for this module */
function applyTemplate(
  text: string,
  templateParams: Record<string, string>,
  template: string | undefined,
  registry: ModuleRegistry
): string {
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
