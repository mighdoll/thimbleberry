import { parseModule } from "./ParseModule.js";
import { Export, WgslModule } from "./Linker.js";

export type ApplyTemplate = (src: string, params: Record<string, string>) => string;

export interface Template {
  name: string;
  applyTemplate: ApplyTemplate;
}

/** a single export from a module */
export interface ModuleExport {
  module: WgslModule;
  export: Export;
}

export class ModuleRegistry {
  // map from export names to a map of module names to exports
  private exports = new Map<string, ModuleExport[]>();
  private templates = new Map<string, ApplyTemplate>();

  /** register a module's exports so that imports can find it */
  registerModule(...sources: string[]): void {
    const modules = sources.map(src => parseModule(src));
    modules.forEach(m => this.addModule(m))
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

  private addModule(module:WgslModule): void {
    module.exports.forEach(e => this.addModuleExport(e, module));
  }

  private addModuleExport(exp:Export, module:WgslModule): void {
    const moduleExport: ModuleExport = { module, export:exp };
    const existing = this.exports.get(exp.name);
    if (existing) {
      existing.push(moduleExport);
    } else {
      this.exports.set(exp.name, [moduleExport]);
    }
  }

}
