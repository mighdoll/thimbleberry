import { Export } from "./Linker.js";
import { exportRegex, fnOrStructRegex } from "./Parsing.js";

/** parse module text to find the exports */
export function parseExports(src: string): Export[] {
  let currentExport: Partial<Export> | undefined;
  let currentExportLines: string[] = [];
  const exports: Export[] = [];

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
    exports.push(currentExport as Export);
  }
  return exports;
}
