import { elseRegex, endifRegex, ifRegex } from "./Parsing.js";

interface IfState {
  name: string;
  valid: boolean;
}

/** strip out lines elided by #if #endif directives (and the directives themselves) */
export function stripIfDirectives(src: string, params: Record<string, any>): string {
  const out: string[] = [];
  const ifStack: IfState[] = [];
  src.split("\n").forEach((line, lineNum) => {
    const { ifMatch, elseMatch, endifMatch } = matchIfDirectives(line);

    if (ifMatch) {
      const name = ifMatch.groups!.name;
      const invert = ifMatch.groups!.bang;
      const valid = invert ? !params[name] : params[name];
      ifStack.push({ name, valid });
    } else if (elseMatch) {
      const top = ifStack.pop();
      if (top) {
        ifStack.push({ ...top, valid: !top.valid });
      } else {
        console.error(`else without if ${lineNum}\n\t${line}`);
      }
    } else if (endifMatch) {
      ifStack.pop();
    } else {
      if (ifStack.length === 0 || ifStack.every(s => s.valid)) {
        out.push(line);
      }
    }
  });

  return out.join("\n");
}

interface MatchIfDirectives {
  ifMatch?: RegExpMatchArray;
  endifMatch?: RegExpMatchArray;
  elseMatch?: RegExpMatchArray;
}

function matchIfDirectives(line: string): MatchIfDirectives {
  const ifMatch = line.match(ifRegex);
  if (ifMatch) {
    return { ifMatch };
  }
  const elseMatch = line.match(elseRegex);
  if (elseMatch) {
    return { elseMatch };
  }
  const endifMatch = line.match(endifRegex);
  if (endifMatch) {
    return { endifMatch };
  }
  return {};
}
