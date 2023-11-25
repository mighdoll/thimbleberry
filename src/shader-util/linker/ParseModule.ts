import { TextExport, TextModule } from "./Linker.js";
import { exportRegex, fnOrStructRegex, templateRegex } from "./Parsing.js";

let unnamedModuleDex = 0;

/** parse module text to find the #export, #template, and #module declaraions */
export function parseModule(src: string, defaultModuleName?: string): TextModule {
  let template: string | undefined;
  const exports: TextExport[] = [];
  let currentExport: Partial<TextExport> | undefined;
  let currentExportLines: string[] = [];

  src.split("\n").forEach((line, lineNum) => {
    const exportMatch = line.match(exportRegex);
    if (exportMatch) {
      console.assert(
        currentExport === undefined,
        `found export while parsing export line: ${lineNum}`
      );
      const params = exportMatch.groups?.params?.split(",").map(p => p.trim()) ?? [];
      currentExport = { params };
      currentExportLines = [];
    } else {
      const templateMatch = line.match(templateRegex);
      if (templateMatch) {
        template = templateMatch.groups?.name;
      } else if (currentExport) {
        currentExportLines.push(line);
        // TODO allow for explicitly named exports (and don't look for following fn or struct)
        if (currentExport.name === undefined) {
          const found = line.match(fnOrStructRegex);
          if (found) {
            currentExport.name = found.groups?.name;
          }
        }
      }
    }
  });

  if (currentExport) {
    if (currentExport.name === undefined) {
      console.warn("name not found for export", currentExport);
    }
    currentExport.src = currentExportLines.join("\n");
    exports.push(currentExport as TextExport);
  }

  const name = defaultModuleName ?? `module${unnamedModuleDex++}`;
  return { exports, name, template };
}
