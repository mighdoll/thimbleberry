import {
  CodeGenFn,
  GeneratorExport,
  GeneratorModule,
  TextExport,
  TextModule
} from "./Linker.js";
import { parseModule } from "./ParseModule.js";


/** A named function to transform code fragments (e.g. by inserting parameters) */
export interface Template {
  name: string;
  applyTemplate: ApplyTemplate;
}
export type ApplyTemplate = (src: string, params: Record<string, string>) => string;

/** a single export from a module */
type ModuleExport = TextModuleExport | GeneratorModuleExport;

export interface TextModuleExport {
  module: TextModule;
  export: TextExport;
  kind: "text";
}
export interface GeneratorModuleExport {
  module: GeneratorModule;
  export: GeneratorExport;
  kind: "function";
}

/** unique index for naming otherwise unnamed generator modules */
let unnamedCodeDex = 0;

/** A container of exportable code fragments, code generator functions, and template processors */
export class ModuleRegistry {
  // map from export names to a map of module names to exports
  private exports = new Map<string, ModuleExport[]>();
  private templates = new Map<string, ApplyTemplate>();

  constructor(...src: string[]) {
    this.registerModules(...src);
  }

  /** register modules' exports */
  registerModules(...sources: string[]): void {
    const modules = sources.map(src => parseModule(src));
    modules.forEach(m => this.addTextModule(m));
  }

  /** register one module's exports  */
  registerOneModule(src: string, moduleName?: string): void {
    const m = parseModule(src, moduleName);
    this.addTextModule(m);
  }

  /** register a function that generates code on demand */
  registerGenerator(
    exportName: string,
    fn: CodeGenFn,
    params?: string[],
    moduleName?: string
  ): void {
    const exp = { name: exportName, params: params ?? [], generate: fn };
    const module = { name: moduleName ?? `funModule${unnamedCodeDex++}`, exports: [exp] };
    const moduleExport: GeneratorModuleExport = { module, export: exp, kind: "function" };
    this.addModuleExport(moduleExport);
  }

  /** register a template processor  */
  registerTemplate(...templates: Template[]): void {
    templates.forEach(t => this.templates.set(t.name, t.applyTemplate));
  }

  /** fetch a template processor */
  getTemplate(name: string): ApplyTemplate | undefined {
    return this.templates.get(name);
  }

  /** return a reference to an exported text fragment or code generator (i.e. in response to an #import request) */
  getModuleExport(exportName: string, moduleName?: string): ModuleExport | undefined {
    const exports = this.exports.get(exportName);
    if (!exports) {
      return undefined;
    } else if (moduleName) {
      return exports.find(e => e.module.name === moduleName);
    } else if (exports.length === 1) {
      return exports[0];
    } else {
      const moduleNames = exports.map(e => e.module.name).join(", ");
      console.warn(
        `Multiple modules export ${exportName}. (${moduleNames}) ` +
          `Use "#import ${exportName} from <moduleName>" to select which one import`
      );
    }
  }

  private addTextModule(module: TextModule): void {
    module.exports.forEach(e => {
      const moduleExport: TextModuleExport = { module, export: e, kind: "text" };
      this.addModuleExport(moduleExport);
    });
  }

  private addModuleExport(moduleExport: ModuleExport): void {
    const exportName = moduleExport.export.name;
    const existing = this.exports.get(exportName);
    if (existing) {
      existing.push(moduleExport);
    } else {
      this.exports.set(exportName, [moduleExport]);
    }
  }
}
