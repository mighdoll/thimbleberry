const optComment = /(\s*\/\/)?/;
const exportDirective = /\s*#export\s+(?<export>[\w-]+)/;
const importReplace = /\s*#importReplace\s+(?<import>[\w-]+)/;
const endImport = /\s*#endImport/;
const optParams = /\s*(\((?<params>[\w, ]*)\))?/;
export const exportRegex = regexConcat(optComment, exportDirective, optParams);
export const importReplaceRegex = regexConcat(optComment, importReplace, optParams);
export const endImportRegex = regexConcat(optComment, endImport);

function regexConcat(...exp: RegExp[]): RegExp {
  const concat = exp.map(e => e.source).join("");
  return new RegExp(concat, "i");
}

const tokenRegex = /(\w+)/gi;

export function replaceTokens(text: string, replace: Record<string, string>): string {
  return text.replaceAll(tokenRegex, s => (s in replace ? replace[s] : s));
}
