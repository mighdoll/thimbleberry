import { TextExport, TextModule } from "./Linker.js";
import { exportRegex, fnOrStructRegex, moduleRegex, templateRegex } from "./Parsing.js";

let unnamedModuleDex = 0;

/** parse module text to find the #export, #template, and #module declaraions */
export function parseModule(src: string, defaultModuleName?: string): TextModule {
  let template: string | undefined;
  const exports: TextExport[] = [];
  let currentExport: Partial<TextExport> | undefined;
  let currentExportLines: string[] = [];
  let moduleName:string | undefined;

  src.split("\n").forEach((line, lineNum) => {
    const { exportMatch, templateMatch, moduleMatch } = matchModuleDirectives(line);
    if (exportMatch) {
      console.assert(
        currentExport === undefined,
        `found export while parsing export line: ${lineNum}`
      );
      const params = exportMatch.groups?.params?.split(",").map(p => p.trim()) ?? [];
      const name = exportMatch.groups?.name;
      currentExport = { params, name };
      currentExportLines = [];
    } else if (templateMatch) {
      template = templateMatch.groups?.name;
    } else if (moduleMatch) {
      moduleName = moduleMatch.groups?.name;
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
    exports.push(currentExport as TextExport);
  }

  const name = moduleName ?? defaultModuleName ?? `module${unnamedModuleDex++}`;
  return { exports, name, template };
}

interface ModuleDirectiveMatch {
  exportMatch?: RegExpMatchArray;
  templateMatch?: RegExpMatchArray;
  moduleMatch?: RegExpMatchArray;
}

function matchModuleDirectives(line: string): ModuleDirectiveMatch {
  const exportMatch = line.match(exportRegex);
  if (exportMatch) {
    return { exportMatch };
  }
  const templateMatch = line.match(templateRegex);
  if (templateMatch) {
    return { templateMatch };
  }
  const moduleMatch = line.match(moduleRegex);
  if (moduleMatch) {
    return { moduleMatch };
  }

  return {};
}
