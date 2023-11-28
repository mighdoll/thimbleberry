import { ModuleRegistry } from "./ModuleRegistry.js";
import { endImportRegex, importRegex, replaceTokens } from "./Parsing.js";
import {
  DeclaredNames,
  declAdd,
  globalDeclarations,
  resolveNameConflicts,
} from "./Declarations.js";

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
  src: string; // to be inserted at #import location
  topSrc?: string; // to be inserted at top level of #import wgsl (not inside fn)
}

export type CodeGenFn = (params: Record<string, string>) => string | TextExport;

export interface GeneratorExport extends ExportBase {
  generate: CodeGenFn;
}

/** parse shader text for imports, return wgsl with all imports injected */
export function linkWgsl(src: string, registry: ModuleRegistry): string {
  const declarations = globalDeclarations(src);
  return insertImportsRecursive(src, registry, new Set(), declarations, 0);
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
  imported: Set<string>,
  declarations: DeclaredNames,
  conflictCount: number
): string {
  const out: string[] = [];
  const topOut: string[] = [];
  let importReplacing = false; // true while we're reading lines inside an importReplace

  // scan through the lines looking for #import directives
  src.split("\n").forEach((line, lineNum) => {
    const importMatch = line.match(importRegex);
    if (importMatch) {
      const groups = importMatch.groups;
      importReplacing = checkImportReplace(importReplacing, groups, line, lineNum);

      // import module text
      const importName = groups!.name;
      const params = groups?.params?.split(",").map(p => p.trim()) ?? [];
      const asRename = groups?.importAs;
      const moduleName = groups?.importFrom;
      const _args = { importName, moduleName, registry, params, asRename };
      const args = { ..._args, imported, declarations, lineNum, line, conflictCount };
      const { src: insertSrc, topSrc = "" } = importModule(args);
      const resolved = [insertSrc, topSrc].map(s => {
        const result = resolveNameConflicts(s, declarations, conflictCount);
        result.conflicted && conflictCount++;
        return result;
      });
      out.push(resolved[0].src);
      topOut.push(resolved[1].src);
      resolved.map(({ declared }) => {
        declAdd(declarations, declared);
      });
    } else if (importReplacing) {
      const endImport = line.match(endImportRegex);
      if (endImport) {
        importReplacing = false;
      }
    } else {
      out.push(line);
    }
  });
  return out.join("\n").concat(topOut.join("\n"));
}

function checkImportReplace(
  replacing: boolean,
  groups: Record<string, string> | undefined,
  line: string,
  lineNum: number
): boolean {
  if (groups?.importCmd === "importReplace") {
    console.assert(
      !replacing,
      `#importReplace while inside #importReplace line: ${lineNum}\n>>\t${line}`
    );
    return true;
  } else {
    return replacing;
  }
}

interface ImportModuleArgs {
  importName: string;
  asRename?: string;
  moduleName?: string;
  registry: ModuleRegistry;
  params: string[];
  imported: Set<string>;
  declarations: DeclaredNames;
  lineNum: number;
  line: string;
  conflictCount: number;
}

export interface TextInsert {
  src: string;
  topSrc?: string;
}

const emptyInsert: TextInsert = { src: "" };

/** import a module and return the text to be inserted */
function importModule(args: ImportModuleArgs): TextInsert {
  const { importName, asRename, moduleName, registry, params } = args;
  const { imported, declarations, lineNum, line, conflictCount } = args;

  const moduleExport = registry.getModuleExport(importName, moduleName);
  if (!moduleExport) {
    console.error(
      `#importReplace module export "${importName}" not found: at ${lineNum}\n>>\t${line}`
    );
    return emptyInsert;
  }

  const importAs = asRename ?? moduleExport.export.name;
  const fullImport = fullImportName(importAs, moduleExport.module.name, params);
  if (imported.has(fullImport)) {
    return emptyInsert;
  }

  imported.add(fullImport);

  const entries = moduleExport.export.params.map((p, i) => [p, params[i]]);
  const paramsRecord = Object.fromEntries(entries);

  let texts: string[];
  const exportName = moduleExport.export.name;

  if (moduleExport.kind === "text") {
    const template = moduleExport.module.template;
    const { src, topSrc = "" } = moduleExport.export;
    const templated = [src, topSrc].map(s =>
      applyTemplate(s, paramsRecord, template, registry)
    );
    texts = templated.map(s => replaceTokens(s, paramsRecord));
  } else if (moduleExport.kind === "function") {
    const result = moduleExport.export.generate(paramsRecord);
    if (typeof result === "string") {
      texts = [result];
    } else {
      const { src, topSrc = "" } = result;
      texts = [src, topSrc];
    }
  } else {
    console.error(`unexpected module export: ${JSON.stringify(moduleExport, null, 2)}`);
    return emptyInsert;
  }
  const withImports = texts.map(s =>
    insertImportsRecursive(s, registry, imported, declarations, conflictCount)
  );

  const src = renameExport(withImports[0], exportName, asRename);
  const topSrc = texts[1];
  return { src, topSrc };
}

/** run a template processor if one is defined for this module */
function applyTemplate(
  text: string,
  templateParams: Record<string, string>,
  template: string | undefined,
  registry: ModuleRegistry
): string {
  if (text && template) {
    const applyTemplate = registry.getTemplate(template);
    if (applyTemplate) {
      return applyTemplate(text, templateParams);
    } else {
      console.warn(`template ${template} not registered`);
    }
  }
  return text;
}

function renameExport(text: string | undefined, find: string, replace?: string): string {
  if (!text) {
    return "";
  } else if (!replace) {
    return text;
  } else {
    return text.replace(find, replace);
  }
}
