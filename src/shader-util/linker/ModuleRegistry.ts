import { Export, WgslModule } from "./Linker.js";
import { exportRegex, fnOrStructRegex } from "./Parsing.js";

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
      const params = found.groups?.params?.split(",").map(p => p.trim()) ?? [];
      currentExport = { params };
      currentExportLines = [];
    } else if (currentExport) {
      currentExportLines.push(line);
      if (currentExport.name === undefined) {
        const found = line.match(fnOrStructRegex);
        if (found) {
          currentExport.name = found.groups?.name;
        }
      }
    }
  });
  if (currentExport) {
    if (currentExport.name === undefined) {
      console.warn("name not found for export", currentExport);
    }
    currentExport.src = currentExportLines.join("\n");
    results.push(currentExport as Export);
  }
  return { exports: results };
}
