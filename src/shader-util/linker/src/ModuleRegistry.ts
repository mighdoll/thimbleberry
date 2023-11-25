import {
  Export,
  GeneratorExport,
  GeneratorModule,
  TextExport,
  TextModule,
  WgslModule,
} from "./Linker.js";
import { parseModule } from "./ParseModule.js";

export type ApplyTemplate = (src: string, params: Record<string, string>) => string;

export interface Template {
  name: string;
  applyTemplate: ApplyTemplate;
}

export interface ModuleExportBase {
  module: WgslModule;
  export: Export;
  kind: "text" | "function";
}

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

export class ModuleRegistry {
  // map from export names to a map of module names to exports
  private exports = new Map<string, ModuleExport[]>();
  private templates = new Map<string, ApplyTemplate>();

  constructor(...src: string[]) {
    this.registerModule(...src);
  }

  /** register a module's exports so that imports can find it */
  registerModule(...sources: string[]): void {
    const modules = sources.map(src => parseModule(src));
    modules.forEach(m => this.addTextModule(m));
  }

  registerGeneratorModule(generatorModule: GeneratorModule): void {
    this.addGeneratorModule(generatorModule);
  }

  registerTemplate(...templates: Template[]): void {
    templates.forEach(t => this.templates.set(t.name, t.applyTemplate));
  }

  getTemplate(name: string): ApplyTemplate | undefined {
    return this.templates.get(name);
  }

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
        `multiple modules export ${exportName}. (${moduleNames})` +
          `use "#import ${exportName} from <moduleName>" to select which one import`
      );
    }
  }

  private addTextModule(module: TextModule): void {
    module.exports.forEach(e => {
      const moduleExport: TextModuleExport = { module, export: e, kind: "text" };
      this.addModuleExport(moduleExport);
    });
  }

  private addGeneratorModule(module: GeneratorModule): void {
    module.exports.forEach(e => {
      const moduleExport: GeneratorModuleExport = { module, export: e, kind: "function" };
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
