export function linkShaders(): string {
  return "";
}

interface Export {
  name: string;
  src: string;
  params: string[];
}

const comment = /.*\/\//;
const exportDirective = /\s*#export\s+(?<export>[\w-]+)/;
const importReplaceDirective = /\s*#importReplace\s+(?<export>[\w-]+)/;
const optParams = /\s*(\((?<params>[\w, ]*)\))?/;
export const exportRegex = regexConcat(comment, exportDirective, optParams);
export const importReplaceRegex = regexConcat(comment, importReplaceDirective, optParams);

export function parseExports(src: string): Export[] {
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
  return results;
}


function regexConcat(...exp: RegExp[]): RegExp {
  const concat = exp.map(e => e.source).join("");
  return new RegExp(concat, "i");
}
