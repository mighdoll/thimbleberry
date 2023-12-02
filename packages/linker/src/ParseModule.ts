import { TextExport, TextModule } from "./Linker.js";
import {
  endExportRegex,
  endInsertRegex,
  exportRegex,
  fnOrStructRegex,
  moduleRegex,
  templateRegex,
} from "./Parsing.js";

let unnamedModuleDex = 0;

/** parse module text to find the #export, #template, and #module declaraions */
export function parseModule(src: string, defaultModuleName?: string): TextModule {
  let template: string | undefined;
  const exports: TextExport[] = [];
  let currentExport: Partial<TextExport> | undefined;
  let insertLines: string[] = [];
  let moduleName: string | undefined;
  let rootLines: string[] | undefined;

  src.split("\n").forEach(line => {
    const matches = matchModuleDirectives(line);
    const { exportMatch, endInsertMatch, endExportMatch } = matches;
    const { templateMatch, moduleMatch } = matches;
    if (exportMatch) {
      pushCurrentExport();

      const groups = exportMatch.groups;
      currentExport = {
        params: groups?.params?.split(",").map(p => p.trim()) ?? [],
        name: groups?.name,
      };
    } else if (templateMatch) {
      template = templateMatch.groups?.name;
    } else if (moduleMatch) {
      moduleName = moduleMatch.groups?.name;
    } else if (endInsertMatch) {
      rootLines = [];
    } else if (endExportMatch) {
      pushCurrentExport();
    } else if (currentExport) {
      rootLines ? rootLines.push(line) : insertLines.push(line);
      if (currentExport.name === undefined) {
        const found = line.match(fnOrStructRegex);
        if (found) {
          currentExport.name = found.groups?.name;
        }
      }
    }
  });

  pushCurrentExport();

  const name = moduleName ?? defaultModuleName ?? `module${unnamedModuleDex++}`;
  return { exports, name, template };

  function pushCurrentExport(): void {
    if (currentExport) {
      if (currentExport.name === undefined) {
        console.warn("name not found for export", currentExport);
      }
      currentExport.src = insertLines.join("\n");
      currentExport.rootSrc = rootLines && rootLines.join("\n");
      exports.push(currentExport as TextExport);

      currentExport = undefined;
      rootLines = undefined;
      insertLines = [];
    }
  }
}

interface ModuleDirectiveMatch {
  exportMatch?: RegExpMatchArray;
  templateMatch?: RegExpMatchArray;
  moduleMatch?: RegExpMatchArray;
  endInsertMatch?: RegExpMatchArray;
  endExportMatch?: RegExpMatchArray;
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
  const endInsertMatch = line.match(endInsertRegex);
  if (endInsertMatch) {
    return { endInsertMatch };
  }
  const endExportMatch = line.match(endExportRegex);
  if (endExportMatch) {
    return { endExportMatch };
  }

  return {};
}
