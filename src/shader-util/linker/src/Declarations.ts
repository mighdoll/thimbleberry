import {
  fnPrefix,
  fnRegex,
  fnRegexGlobal,
  notFnDecl,
  regexConcatGlobal,
  structRegex,
  structRegexGlobal
} from "./Parsing.js";

export interface DeclaredNames {
  fns: Set<string>;
  structs: Set<string>;
}

let conflictCount = 0;

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

interface Deconflicted {
  deconflicted: string;
  deconflictedNames: DeclaredNames;
}

export function resolveNameConflicts(
  text: string,
  declared: DeclaredNames
): Deconflicted {
  const moduleDeclarations = globalDeclarations(text);
  const conflicts = declIntersection(declared, moduleDeclarations);
  const renames = deconflictNames(conflicts);
  const deconflicted = rewriteConflicting(text, renames);

  conflictCount++;
  // const orig = declDifference(moduleDeclarations, conflicts)
  return { deconflicted: deconflicted, deconflictedNames: declared /* TOOD */ };
}

interface DeclRewrites {
  fns: Map<string, string>;
  structs: Map<string, string>;
}

function deconflictNames(conflicts: DeclaredNames): DeclRewrites {
  const fns: Map<string, string> = new Map();
  const structs: Map<string, string> = new Map();
  conflicts.fns.forEach(name => fns.set(name, `${name}_${conflictCount}`));
  conflicts.structs.forEach(name => structs.set(name, `${name}_${conflictCount}`));
  return { fns, structs };
}

export function rewriteConflicting(text: string, renames:DeclRewrites): string {
  let newText = text;
  [...renames.fns.entries()].forEach(([orig, deconflicted])=> {
    newText = replaceFnDecl(newText, orig, deconflicted);
    newText = replaceFnCalls(newText, orig, deconflicted);
  });
  // TODO structs
  return newText;
}

export function declIntersection(
  main: DeclaredNames,
  other: DeclaredNames
): DeclaredNames {
  const fns = intersection(main.fns, other.fns);
  const structs = intersection(main.structs, other.structs);
  return { fns, structs };
}

function intersection<T>(a: Set<T>, b: Set<T>): Set<T> {
  const both = [...a.keys()].filter(k => b.has(k));
  return new Set(both);
}
