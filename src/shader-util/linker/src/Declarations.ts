import {
  braceStartAhead,
  colonBehind,
  commaOrGtAhead,
  fnPrefix,
  fnRegex,
  fnRegexGlobal,
  notFnDecl,
  parenStartAhead,
  regexConcat,
  structPrefix,
  structRegex,
  structRegexGlobal,
  ltBehind,
} from "./Parsing.js";

export interface Deconflicted {
  src: string;
  declared: DeclaredNames;
  conflicted: boolean;
}

export interface DeclaredNames {
  fns: Set<string>;
  structs: Set<string>;
}

/** find fn and struct declarations in a wgsl text
 * (declared names need to be protected from
 *  conflict with imported text declarations)
 */
export function globalDeclarations(wgsl: string): DeclaredNames {
  return {
    fns: new Set(fnDecls(wgsl)),
    structs: new Set(structDecls(wgsl)),
  };
}

/** rewrite a proposed wgsl text to avoid name conflict with already declared names
 * @return the rewritten text and the of declared names
 */
export function resolveNameConflicts(
  proposedText: string,
  declared: DeclaredNames,
  conflictCount: number
): Deconflicted {
  // rewrite text replacing confliced names
  const moduleDeclarations = globalDeclarations(proposedText);
  const conflicts = declIntersection(declared, moduleDeclarations);
  const renames = deconflictNames(conflicts, conflictCount);
  const src = rewriteConflicting(proposedText, renames);

  // report new module names incl rewrites
  const newNames = rewrittenNames(renames);
  const unchangedModuleNames = declDifference(moduleDeclarations, conflicts);
  const deconflictedNames = declUnion(unchangedModuleNames, newNames);

  return { src, declared: deconflictedNames, conflicted: !declIsEmpty(conflicts) };
}

/** find function declarations in a wgsl text */
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

/** find struct declarations in a wgsl text */
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

/** replace function calls in a wgsl text */
export function replaceFnCalls(text: string, fnName: string, newName: string): string {
  const nameRegex = new RegExp(fnName);
  const fnRegex = regexConcat("g", notFnDecl, nameRegex, parenStartAhead);
  return text.replaceAll(fnRegex, `${newName}`);
}

function replaceFnDecl(text: string, fnName: string, newName: string): string {
  const nameRegex = new RegExp(fnName);
  const declRegex = regexConcat("", fnPrefix, nameRegex, parenStartAhead);
  return text.replace(declRegex, `fn ${newName}`);
}

function replaceStructDecl(text: string, structName: string, newName: string): string {
  const nameRegex = new RegExp(structName);
  const structRegex = regexConcat("", structPrefix, nameRegex, braceStartAhead);
  return text.replace(structRegex, `struct ${newName}`);
}

function replaceStructRefs(text: string, structName: string, newName: string): string {
  const nameRegex = new RegExp(structName);
  // replace ': MyStruct' with a: MyStruct_0
  const structTypeExpression = regexConcat("g", colonBehind, nameRegex);
  const expressionsReplaced = text.replaceAll(structTypeExpression, newName);

  // replace 'MyStruct(' with MyStruct_0(
  const structConstructor = regexConcat("g", notFnDecl, nameRegex, parenStartAhead);
  const constructReplaced = expressionsReplaced.replaceAll(structConstructor, newName);

  // replace '<MyStruct' with <MyStruct_0
  const structTemplate = regexConcat("g", ltBehind, nameRegex, commaOrGtAhead);
  return constructReplaced.replaceAll(structTemplate, newName);
}

interface DeclRewrites {
  fns: Map<string, string>;
  structs: Map<string, string>;
}

/** @return a map of old name to renamed copy */
function deconflictNames(conflicts: DeclaredNames, conflictCount: number): DeclRewrites {
  const fns: Map<string, string> = new Map();
  const structs: Map<string, string> = new Map();
  conflicts.fns.forEach(name => fns.set(name, `${name}_${conflictCount}`));
  conflicts.structs.forEach(name => structs.set(name, `${name}_${conflictCount}`));
  return { fns, structs };
}

function rewriteConflicting(text: string, renames: DeclRewrites): string {
  let newText = text;
  [...renames.fns.entries()].forEach(([orig, deconflicted]) => {
    newText = replaceFnDecl(newText, orig, deconflicted);
    newText = replaceFnCalls(newText, orig, deconflicted);
  });
  [...renames.structs.entries()].forEach(([orig, deconflicted]) => {
    newText = replaceStructDecl(newText, orig, deconflicted);
    newText = replaceStructRefs(newText, orig, deconflicted);
  });
  return newText;
}

function rewrittenNames(rewrites: DeclRewrites): DeclaredNames {
  const fns = new Set(rewrites.fns.values());
  const structs = new Set(rewrites.structs.values());
  return { fns, structs };
}

/** modify some DeclaredNames to add more */
export function declAdd(base: DeclaredNames, add: DeclaredNames): void {
  base.fns = union(base.fns, add.fns);
  base.structs = union(base.structs, add.structs);
}

function declIntersection(a: DeclaredNames, b: DeclaredNames): DeclaredNames {
  const fns = intersection(a.fns, b.fns);
  const structs = intersection(a.structs, b.structs);
  return { fns, structs };
}

function declUnion(a: DeclaredNames, b: DeclaredNames): DeclaredNames {
  const fns = union(a.fns, b.fns);
  const structs = union(a.structs, b.structs);
  return { fns, structs };
}

function declIsEmpty(decl: DeclaredNames): boolean {
  const { fns, structs } = decl;
  return fns.size === 0 && structs.size === 0;
}

function declDifference(a: DeclaredNames, b: DeclaredNames): DeclaredNames {
  const fns = difference(a.fns, b.fns);
  const structs = difference(a.structs, b.structs);
  return { fns, structs };
}

function intersection<T>(a: Set<T>, b: Set<T>): Set<T> {
  const both = [...a.keys()].filter(k => b.has(k));
  return new Set(both);
}

function union<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a, ...b]);
}

function difference<T>(a: Set<T>, b: Set<T>): Set<T> {
  const diff = [...a.keys()].filter(k => !b.has(k));
  return new Set(diff);
}
