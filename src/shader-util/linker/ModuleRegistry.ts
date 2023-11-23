import { parseExports } from "./Exports.js";
import { Export, WgslModule } from "./Linker.js";

export type ApplyTemplate = (src: string, params: Record<string, string>) => string;

export interface Template {
  name: string;
  applyTemplate: ApplyTemplate;
}

export class ModuleRegistry {
  private exports = new Map<string, Export>();
  private templates = new Map<string, ApplyTemplate>();

  /** register a module's exports so that imports can find it */
  registerModule(...sources: string[]): void {
    const modules = sources.map(parseModule);
    const exports = modules.flatMap(m => m.exports);
    exports.forEach(e => this.exports.set(e.name, e));
  }

  registerTemplate(...templates: Template[]): void {
    templates.forEach(t => this.templates.set(t.name, t.applyTemplate));
  }

  getModule(name: string): Export | undefined {
    return this.exports.get(name);
  }
}

/** parse module text to find the exports */
export function parseModule(src: string): WgslModule {
  return { exports: parseExports(src) };
}
