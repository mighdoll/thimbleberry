export const replaceRegex = /#replace\s+(?<replaces>(.*=.*))/i;
const findUnquoted = /(?<findUnquoted>[\w<>.-]+)/.source;
const findQuoted = /("(?<findQuoted>[^=]+)")/.source;
const replaceKey = /(\s*(?<replaceKey>[\w-]+))/.source;
const keyValuePair = `(${findUnquoted}|${findQuoted})=${replaceKey}`;
export const keyValuesRegex = new RegExp(keyValuePair, "g");
export const oneKeyValueRegex = new RegExp(keyValuePair);

/** for incrementally patching a line with #replace */
interface Patched {
  patchedPrefix: string;
  suffix: string;
}

/**
 * A simple templating scheme for wgsl shaders
 *
 * line-of-text // #replace find=replaceKey find2=replaceKey2
 *  - replaces "find" and "find2" in line-of-text with values from the dictionary
 */
export function applyTemplate(wgsl: string, dict: { [key: string]: any }): string {
  const edit = wgsl.split("\n").flatMap((line, i) => {
    const replaceFound = parseReplaceDirective(line);
    if (replaceFound) {
      const { replaceKeys: xy, bareLine: lineWithoutDirective } = replaceFound;
      return changeLine(lineWithoutDirective, xy, i + 1);
    } else {
      return [line];
    }
  });
  return edit.join("\n");

  /** apply all the replaces patches to the line */
  function changeLine(
    line: string,
    replaces: Record<string, string>,
    lineNum: number
  ): string[] {
    // scan through the patches, applying each patch and accumulating the patchedPrefx
    const kvs = Object.entries(replaces);
    const patched = scan(kvs, patchOne, { patchedPrefix: "", suffix: line });

    // result is the patched prefixes plus any remaining suffix
    const prefixes = patched.map(p => p.patchedPrefix);
    const last = patched.slice(-1)[0];
    const result = [...prefixes, last.suffix].join("");
    return [result];

    /** apply one find,replaceKey patch to a string */
    function patchOne(kv: [string, string], current: Patched): Patched {
      const [key, replaceKey] = kv;
      const text = current.suffix;
      const found = text.indexOf(key);

      if (found >= 0) {
        const start = text.slice(0, found);
        const suffix = text.slice(found + key.length);
        const replaceValue = dict[replaceKey] || missingKey(replaceKey);
        return { patchedPrefix: start + replaceValue, suffix };
      } else {
        return current;
      }
    }

    function missingKey(key: string): string {
      console.warn(`replace key not found: ${key} in line ${lineNum}:\n>> ${line}`);
      return `??${replaceKey}??`;
    }
  }
}

interface ReplaceDirective {
  replaceKeys: Record<string, string>; // keys in the #replace directive
  bareLine: string; // line w/o the #replace directive
}

/** find the #replace directive in a line if it exists */
export function parseReplaceDirective(line: string): ReplaceDirective | undefined {
  const match = line.match(replaceRegex);
  const replaces = match?.groups?.replaces;

  if (replaces) {
    const keyValuePairs = [...replaces.matchAll(keyValuesRegex)];
    const entries = keyValuePairs.flatMap(([pair]) => {
      const kvMatch = pair.match(oneKeyValueRegex);
      const groups = kvMatch?.groups;
      const findKey = groups?.findUnquoted || groups?.findQuoted;
      const replaceKey = groups?.replaceKey;
      return findKey && replaceKey ? [[findKey, replaceKey]] : [];
    });
    const matchStart = match.index!;
    const start = line.slice(0, matchStart);
    const end = line.slice(matchStart + match[0].length);
    const bareLine = start + end;
    return {
      replaceKeys: Object.fromEntries(entries),
      bareLine,
    };
  } else {
    return undefined;
  }
}

/** run an carrying function over every element in an array */
export function scan<T, U>(array: T[], fn: (a: T, b: U) => U, zero: U): U[] {
  const result = [];

  let current = zero;
  for (let i = 0; i < array.length; i++) {
    current = fn(array[i], current);
    result.push(current);
  }
  return result;
}
