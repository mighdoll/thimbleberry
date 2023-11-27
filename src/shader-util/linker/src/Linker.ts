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
  src: string;
}

export type CodeGenFn = (params: Record<string, string>) => string;

export interface GeneratorExport extends ExportBase {
  generate: CodeGenFn;
}

/** parse shader text for imports, return wgsl with all imports injected */
export function linkWgsl(src: string, registry: ModuleRegistry): string {
  const declarations = globalDeclarations(src);
  return insertImportsRecursive(src, registry, new Set(), declarations);
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
  declarations: DeclaredNames
): string {
  const out: string[] = [];
  let importReplacing = false; // true while we're reading lines inside an importReplace

  // scan through the lines looking for #import directives
  src.split("\n").forEach((line, lineNum) => {
    const importMatch = line.match(importRegex);
    if (importMatch) {
      const groups = importMatch.groups;
      const importName = groups!.name;
      const params = groups?.params?.split(",").map(p => p.trim()) ?? [];

      if (groups?.importCmd === "importReplace") {
        console.assert(
          !importReplacing,
          `#importReplace while inside #importReplace line: ${lineNum}`
        );
        importReplacing = true;
      }

      const asRename = groups?.importAs;

      const moduleName = groups?.importFrom;
      const _args = { importName, moduleName, registry, params, asRename };
      const args = { ..._args, imported, declarations, lineNum, line };
      const text = importModule(args);
      const moduleDeclarations = globalDeclarations(text);
      const { src, declared } = resolveNameConflicts(text, moduleDeclarations);
      out.push(src);
      declAdd(moduleDeclarations, declared);

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
}

function importModule(args: ImportModuleArgs): string {
  const { importName, asRename, moduleName, registry, params } = args;
  const { imported, declarations, lineNum, line } = args;

  const moduleExport = registry.getModuleExport(importName, moduleName);
  if (!moduleExport) {
    console.error(
      `#importReplace module export "${importName}" not found: at ${lineNum}\n>>\t${line}`
    );
    return "";
  }

  const importAs = asRename ?? moduleExport.export.name;
  const fullImport = fullImportName(importAs, moduleExport.module.name, params);
  if (imported.has(fullImport)) {
    return "";
  }

  imported.add(fullImport);

  const entries = moduleExport.export.params.map((p, i) => [p, params[i]]);
  const paramsRecord = Object.fromEntries(entries);

  let text: string | undefined = undefined;
  const exportName = moduleExport.export.name;

  if (moduleExport.kind === "text") {
    const template = moduleExport.module.template;
    const exp = moduleExport.export;
    text = importText(exp, template, registry, paramsRecord, imported, declarations);
  } else if (moduleExport.kind === "function") {
    const exp = moduleExport.export;
    text = importGenerator(exp, registry, paramsRecord, imported, declarations);
  } else {
    console.error(`unexpected module export: ${JSON.stringify(moduleExport, null, 2)}`);
  }
  return renameExport(text, exportName, asRename);
}

function importText(
  textExport: TextExport,
  template: string | undefined,
  registry: ModuleRegistry,
  paramsRecord: Record<string, string>,
  imported: Set<string>,
  declarations: DeclaredNames
): string {
  const importSrc = textExport.src;
  const importText = insertImportsRecursive(importSrc, registry, imported, declarations);

  const templated = applyTemplate(importText, paramsRecord, template, registry);
  const patched = replaceTokens(templated, paramsRecord); // TODO replace tokens pre-import

  return patched;
}

function importGenerator(
  generatorExport: GeneratorExport,
  registry: ModuleRegistry,
  paramsRecord: Record<string, string>,
  imported: Set<string>,
  declarations: DeclaredNames
): string {
  const generated = generatorExport.generate(paramsRecord);
  const importText = insertImportsRecursive(generated, registry, imported, declarations);
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

function renameExport(text: string | undefined, find: string, replace?: string): string {
  if (!text) {
    return "";
  } else if (!replace) {
    return text;
  } else {
    return text.replace(find, replace);
  }
}
