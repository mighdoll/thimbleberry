import {
  fnPrefix,
  fnRegex,
  fnRegexGlobal,
  notFnDecl,
  parenStartAhead,
  regexConcatGlobal,
  structRegex,
  structRegexGlobal,
} from "./Parsing.js";

export interface DeclaredNames {
  fns: Set<string>;
  structs: Set<string>;
}


export interface Deconflicted {
  src: string;
  declared: DeclaredNames;
  conflicted: boolean;
}

export function resolveNameConflicts(
  text: string,
  declared: DeclaredNames,
  conflictCount: number
): Deconflicted {
  // rewrite text replacing confliced names
  const moduleDeclarations = globalDeclarations(text);
  const conflicts = declIntersection(declared, moduleDeclarations);
  const renames = deconflictNames(conflicts, conflictCount);
  const src = rewriteConflicting(text, renames);

  // report new + old declared names
  const newNames = rewrittenNames(renames);
  const orig = declDifference(moduleDeclarations, conflicts);
  const deconflictedNames = declUnion(orig, newNames);

  return { src, declared: deconflictedNames, conflicted: !declIsEmpty(conflicts) };
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
  const fnRegex = regexConcat("g", notFnDecl, nameRegex, parenStartAhead);
  return text.replaceAll(fnRegex, `${newName}`);
}


interface DeclRewrites {
  fns: Map<string, string>;
  structs: Map<string, string>;
}

function deconflictNames(conflicts: DeclaredNames, conflictCount:number): DeclRewrites {
  const fns: Map<string, string> = new Map();
  const structs: Map<string, string> = new Map();
  conflicts.fns.forEach(name => fns.set(name, `${name}_${conflictCount}`));
  conflicts.structs.forEach(name => structs.set(name, `${name}_${conflictCount}`));
  return { fns, structs };
}

export function rewriteConflicting(text: string, renames: DeclRewrites): string {
  let newText = text;
  [...renames.fns.entries()].forEach(([orig, deconflicted]) => {
    newText = replaceFnDecl(newText, orig, deconflicted);
    newText = replaceFnCalls(newText, orig, deconflicted);
  });
  // TODO structs
  return newText;
}

function rewrittenNames(rewrites: DeclRewrites): DeclaredNames {
  const fns = new Set(rewrites.fns.values());
  const structs = new Set(rewrites.structs.values());
  return { fns, structs };
}

export function declIntersection(a: DeclaredNames, b: DeclaredNames): DeclaredNames {
  const fns = intersection(a.fns, b.fns);
  const structs = intersection(a.structs, b.structs);
  return { fns, structs };
}

export function declDifference(a: DeclaredNames, b: DeclaredNames): DeclaredNames {
  const fns = difference(a.fns, b.fns);
  const structs = difference(a.structs, b.structs);
  return { fns, structs };
}

export function declUnion(a: DeclaredNames, b: DeclaredNames): DeclaredNames {
  const fns = union(a.fns, b.fns);
  const structs = union(a.structs, b.structs);
  return { fns, structs };
}

export function declIsEmpty(decl: DeclaredNames): boolean {
  const { fns, structs } = decl;
  return fns.size === 0 && structs.size === 0;
}

export function declAdd(base: DeclaredNames, add: DeclaredNames): void {
  base.fns = union(base.fns, add.fns);
  base.structs = union(base.structs, add.structs);
}

function intersection<T>(a: Set<T>, b: Set<T>): Set<T> {
  const both = [...a.keys()].filter(k => b.has(k));
  return new Set(both);
}

function difference<T>(a: Set<T>, b: Set<T>): Set<T> {
  const diff = [...a.keys()].filter(k => !b.has(k));
  return new Set(diff);
}

function union<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a, ...b]);
}