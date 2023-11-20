import { Export, WgslModule } from "./Linker.js";
import { exportRegex } from "./ParseDirectives.js";

export class ModuleRegistry {
  private exports = new Map<string, Export>();

/** register a module's exports so that imports can find it */
  registerModule(src: string): void {
    const module = parseModule(src);
    module.exports.forEach(e => this.exports.set(e.name, e));
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