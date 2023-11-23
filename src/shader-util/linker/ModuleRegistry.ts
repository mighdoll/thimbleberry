import { parseExports } from "./Exports.js";
import { Export, WgslModule } from "./Linker.js";

export class ModuleRegistry {
  private exports = new Map<string, Export>();

  /** register a module's exports so that imports can find it */
  registerModule(...sources: string[]): void {
    const modules = sources.map(parseModule);
    const exports = modules.flatMap(m => m.exports);
    exports.forEach(e => this.exports.set(e.name, e));
  }

  getModule(name: string): Export | undefined {
    return this.exports.get(name);
  }
}

/** parse module text to find the exports */
export function parseModule(src: string): WgslModule {
  return { exports: parseExports(src) };
}
