import {
  fnPrefix,
  fnRegex,
  fnRegexGlobal,
  notFnDecl,
  regexConcatGlobal,
  structRegex,
  structRegexGlobal,
  tokenRegex
} from "./Parsing.js";

export function replaceTokens(text: string, replace: Record<string, string>): string {
  return text.replaceAll(tokenRegex, s => (s in replace ? replace[s] : s));
}

export interface DeclaredNames {
  fns: Set<string>;
  structs: Set<string>;
}

export function globalDeclarations(wgsl: string): DeclaredNames {
  return {
    fns: new Set(fnDecls(wgsl)),
    structs: new Set(structDecls(wgsl)),
  };
}

export function fnDecls(wgsl: string): string[] {
  const matches = wgsl.matchAll(fnRegexGlobal);
  const fnNames = [...matches].flatMap(matchDecl => {
    const decl = matchDecl[0];
    const groups = decl.match(fnRegex)?.groups;
    if (!groups) {
      console.error("no groups found for fn decl", decl);
      return [];
    }
    return [groups.name];
  });
  return fnNames;
}

export function structDecls(wgsl: string): string[] {
  const matches = wgsl.matchAll(structRegexGlobal);
  const fnNames = [...matches].flatMap(matchDecl => {
    const decl = matchDecl[0];
    const groups = decl.match(structRegex)?.groups;
    if (!groups) {
      console.error("no groups found for struct decl", decl);
      return [];
    }
    return [groups.name];
  });
  return fnNames;
}

export function replaceFnDecl(text: string, fnName: string, newName: string): string {
  const regex = new RegExp(`${fnPrefix.source}${fnName}`);
  return text.replace(regex, `fn ${newName}`);
}



export function replaceFnCalls(text: string, fnName: string, newName: string): string {
  const nameRegex = new RegExp(`(?<name>${fnName})`);
  const fnRegex = regexConcatGlobal(notFnDecl, nameRegex);
  return text.replaceAll(fnRegex, `${newName}`);
}

