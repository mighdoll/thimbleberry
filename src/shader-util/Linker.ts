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

/** register a module's exports so that imports can find it */
export function registerModule(): void {
  /* TODO */
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

interface WgslModule {
  exports: Export[];
}

interface Export {
  name: string;
  src: string;
  params: string[];
}

const optComment = /(\s*\/\/)?/;
const exportDirective = /\s*#export\s+(?<export>[\w-]+)/;
const importReplace = /\s*#importReplace\s+(?<import>[\w-]+)/;
const endImport = /\s*#endImport/;
const optParams = /\s*(\((?<params>[\w, ]*)\))?/;
export const exportRegex = regexConcat(optComment, exportDirective, optParams);
export const importReplaceRegex = regexConcat(optComment, importReplace, optParams);
export const endImportRegex = regexConcat(optComment, endImport);

/** parse module text to find the exports */
export function parseModule(src: string): WgslModule {
  let currentExport: Partial<Export> | undefined;
  let currentExportLines: string[] = [];
  const results: Export[] = [];

  src.split("\n").forEach((line, lineNum) => {
    const found = line.match(exportRegex);
    if (found) {
      console.assert(
        currentExport === undefined,
        `found export while parsing export line: ${lineNum}`
      );
      const name = found.groups!.export;
      const params = found.groups?.params?.split(",").map(p => p.trim()) ?? [];
      currentExport = { name, params };
      currentExportLines = [];
    } else if (currentExport) {
      currentExportLines.push(line);
    }
  });
  if (currentExport) {
    currentExport.src = currentExportLines.join("\n");
    results.push(currentExport as Export);
  }
  return { exports: results };
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

export class ModuleRegistry {
  private exports = new Map<string, Export>();

  registerModule(src: string): void {
    const module = parseModule(src);
    module.exports.forEach(e => this.exports.set(e.name, e));
  }

  getModule(name: string): Export | undefined {
    return this.exports.get(name);
  }
}

function regexConcat(...exp: RegExp[]): RegExp {
  const concat = exp.map(e => e.source).join("");
  return new RegExp(concat, "i");
}
