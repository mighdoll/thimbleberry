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

const fnOrStruct = /\s*((fn)|(struct))\s*/;
export const fnOrStructRegex = regexConcat(fnOrStruct, name);


function regexConcat(...exp: RegExp[]): RegExp {
  const concat = exp.map(e => e.source).join("");
  return new RegExp(concat, "i");
}

