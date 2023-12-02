import { endifRegex, ifRegex } from "./Parsing.js";

interface IfState {
  name: string;
  valid: boolean;
}

/** strip out lines elided by #if #endif directives (and the directives themselves) */
export function stripIfDirectives(src: string, params: Record<string, any>): string {
  const out: string[] = [];
  const ifStack: IfState[] = [];
  src.split("\n").forEach(line => {
    const { ifMatch, endifMatch } = matchIfDirectives(line);

    if (ifMatch) {
      const name = ifMatch.groups!.name;
      ifStack.push({ name, valid: params[name] });
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
}

function matchIfDirectives(line: string): MatchIfDirectives {
  const ifMatch = line.match(ifRegex);
  if (ifMatch) {
    return { ifMatch };
  }
  const endifMatch = line.match(endifRegex);
  if (endifMatch) {
    return { endifMatch };
  }
  return {};
}
