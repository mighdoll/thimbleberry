const optComment = /(\s*\/\/)?/;
const exportDirective = /\s*#export\s*/;
const importCmd = /\s*#(?<importCmd>(importReplace)|import)\s+/;
const endImport = /\s*#endImport/;
const optParams = /\s*(\((?<params>[\w, ]*)\))?/;
const name = /(?<name>[\w]+)/;
export const exportRegex = regexConcat(optComment, exportDirective, optParams);
export const importRegex = regexConcat(optComment, importCmd, name, optParams);
export const endImportRegex = regexConcat(optComment, endImport);

const fnOrStruct = /\s*((fn)|(struct))\s*/;
export const fnOrStructRegex = regexConcat(fnOrStruct, name);

function regexConcat(...exp: RegExp[]): RegExp {
  const concat = exp.map(e => e.source).join("");
  return new RegExp(concat, "i");
}

const tokenRegex = /(\w+)/gi;

export function replaceTokens(text: string, replace: Record<string, string>): string {
  return text.replaceAll(tokenRegex, s => (s in replace ? replace[s] : s));
}
