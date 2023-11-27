const optComment = /(\s*\/\/)?/;
const exportDirective = /\s*#export\s*/;
const moduleDirective = /\s*#module\s*/;
const templateDirective = /\s*#template\s*/;
const importCmd = /\s*#(?<importCmd>(importReplace)|(import))\s+/;
const optImportAs = /(\s*as\s+(?<importAs>[\w]+))?/;
const optImportFrom = /(\s*from\s+(?<importFrom>[\w]+))?/;
const endImport = /\s*#endImport/;
const optParams = /\s*(\((?<params>[\w, ]*)\))?/;
const name = /(?<name>[\w]+)/;
export const exportRegex = regexConcat(optComment, exportDirective, optParams);
export const importRegex = regexConcat(
  optComment,
  importCmd,
  name,
  optParams,
  optImportAs,
  optImportFrom
);
export const endImportRegex = regexConcat(optComment, endImport);
export const templateRegex = regexConcat(optComment, templateDirective, name);
export const moduleRegex = regexConcat(optComment, moduleDirective, name);
export const tokenRegex = /\b(\w+)\b/gi;

const fnOrStruct = /\s*((fn)|(struct))\s*/;
export const fnOrStructRegex = regexConcat(fnOrStruct, name);

export const fnPrefix = /\bfn\s+/;
const parenStart = /\s*\(\s*/;
export const fnRegex = regexConcat(fnPrefix, name, parenStart);
export const fnRegexGlobal = regexConcatGlobal(fnPrefix, name, parenStart);

const structPrefix = /\bstruct\s+/;
const braceStart = /\s*{\s*/;
export const structRegex = regexConcat(structPrefix, name, braceStart);
export const structRegexGlobal = regexConcatGlobal(structPrefix, name, braceStart);

export const notFnDecl = /(?<!fn\s+)(?<!@\s*)/;

export function regexConcat(...exp: RegExp[]): RegExp {
  const concat = exp.map(e => e.source).join("");
  return new RegExp(concat, "i");
}

export function regexConcatGlobal(...exp: RegExp[]): RegExp {
  const concat = exp.map(e => e.source).join("");
  return new RegExp(concat, "ig");
}

export function replaceTokens(text: string, replace: Record<string, string>): string {
  return text.replaceAll(tokenRegex, s => (s in replace ? replace[s] : s));
}
