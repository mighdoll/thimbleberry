import { fnRegex, fnRegexGlobal, tokenRegex } from "./Parsing.js";

export function replaceTokens(text: string, replace: Record<string, string>): string {
  return text.replaceAll(tokenRegex, s => (s in replace ? replace[s] : s));
}

interface TokenList {
  fns: string[];
  structs: string[];
}

// export function globalDeclTokens(wgsl:string):TokenList {

// }

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
