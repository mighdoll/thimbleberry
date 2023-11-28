import { TextExport, TextModule } from "./Linker.js";
import {
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
  let topLines: string[] | undefined;

  src.split("\n").forEach((line, lineNum) => {
    const matches = matchModuleDirectives(line);
    const { exportMatch, templateMatch, moduleMatch, endInsertMatch } = matches;
    if (exportMatch) {
      console.assert(
        currentExport === undefined,
        `found export while parsing export line: ${lineNum}`
      );
      const params = exportMatch.groups?.params?.split(",").map(p => p.trim()) ?? [];
      const name = exportMatch.groups?.name;
      currentExport = { params, name };
      insertLines = [];
      topLines = undefined;
    } else if (templateMatch) {
      template = templateMatch.groups?.name;
    } else if (moduleMatch) {
      moduleName = moduleMatch.groups?.name;
    } else if (endInsertMatch) {
      topLines = [];
    } else if (currentExport) {
      topLines ? topLines.push(line) : insertLines.push(line);
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
    currentExport.src = insertLines.join("\n");
    currentExport.rootSrc = topLines && topLines.join("\n");
    exports.push(currentExport as TextExport);
  }

  const name = moduleName ?? defaultModuleName ?? `module${unnamedModuleDex++}`;
  return { exports, name, template };
}

interface ModuleDirectiveMatch {
  exportMatch?: RegExpMatchArray;
  templateMatch?: RegExpMatchArray;
  moduleMatch?: RegExpMatchArray;
  endInsertMatch?: RegExpMatchArray;
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

  return {};
}
