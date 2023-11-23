const optComment = /(\s*\/\/)?/;
const exportDirective = /\s*#export\s*/;
const importCmd = /\s*#(?<importCmd>(importReplace)|(import))\s+/;
const endImport = /\s*#endImport/;
const optParams = /\s*(\((?<params>[\w, ]*)\))?/;
const name = /(?<name>[\w]+)/;
const optTemplate = /\s*(template\s*\((?<template>[\w]+\s*)\))?/;
export const exportRegex = regexConcat(
  optComment,
  exportDirective,
  optParams,
  optTemplate
);
export const importRegex = regexConcat(optComment, importCmd, name, optParams);
export const endImportRegex = regexConcat(optComment, endImport);

const fnOrStruct = /\s*((fn)|(struct))\s*/;
export const fnOrStructRegex = regexConcat(fnOrStruct, name);

const tokenRegex = /(\w+)/gi;

function regexConcat(...exp: RegExp[]): RegExp {
  const concat = exp.map(e => e.source).join("");
  return new RegExp(concat, "i");
}

export function replaceTokens(text: string, replace: Record<string, string>): string {
  return text.replaceAll(tokenRegex, s => (s in replace ? replace[s] : s));
}
