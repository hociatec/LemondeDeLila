import * as fs from 'node:fs';

export function readTextFileWithFallback(filePath: string): string {
  const utf8 = fs
    .readFileSync(filePath, { encoding: 'utf8' })
    .replace(/^\uFEFF/, '');
  const replacementCount = (utf8.match(/\uFFFD/g) ?? []).length;
  if (replacementCount <= 2) return utf8;
  return fs
    .readFileSync(filePath, { encoding: 'latin1' })
    .replace(/^\uFEFF/, '');
}

function applyTargetedMojibakeReplacements(value: string): string {
  let out = String(value ?? '');
  if (!out) return '';

  // Double-encoded marker often seen in imported text blobs.
  out = out.replace(/ÃƒÂ/g, 'Ã');

  const replacements: Array<[RegExp, string]> = [
    [/Ã€/g, 'À'],
    [/Ã‚/g, 'Â'],
    [/Ã„/g, 'Ä'],
    [/Ã‡/g, 'Ç'],
    [/Ãˆ/g, 'È'],
    [/Ã‰/g, 'É'],
    [/ÃŠ/g, 'Ê'],
    [/Ã‹/g, 'Ë'],
    [/ÃŽ/g, 'Î'],
    [/ÃÏ/g, 'Ï'],
    [/Ã”/g, 'Ô'],
    [/Ã–/g, 'Ö'],
    [/Ã™/g, 'Ù'],
    [/Ã›/g, 'Û'],
    [/Ãœ/g, 'Ü'],
    [/ÃŸ/g, 'ß'],
    [/Ã /g, 'à'],
    [/Ã¡/g, 'á'],
    [/Ã¢/g, 'â'],
    [/Ã¤/g, 'ä'],
    [/Ã§/g, 'ç'],
    [/Ã¨/g, 'è'],
    [/Ã©/g, 'é'],
    [/Ãª/g, 'ê'],
    [/Ã«/g, 'ë'],
    [/Ã¬/g, 'ì'],
    [/Ã­/g, 'í'],
    [/Ã®/g, 'î'],
    [/Ã¯/g, 'ï'],
    [/Ã²/g, 'ò'],
    [/Ã³/g, 'ó'],
    [/Ã´/g, 'ô'],
    [/Ã¶/g, 'ö'],
    [/Ã¹/g, 'ù'],
    [/Ãº/g, 'ú'],
    [/Ã»/g, 'û'],
    [/Ã¼/g, 'ü'],
    [/Å“/g, 'œ'],
    [/Å’/g, 'Œ'],
    [/\u00E2\u20AC\u2122/g, '’'],
    [/\u00E2\u20AC\u02DC/g, '‘'],
    [/\u00E2\u20AC\u009C/g, '“'],
    [/\u00E2\u20AC\u009D/g, '”'],
    [/\u00E2\u20AC\u201C/g, '–'],
    [/\u00E2\u20AC\u201D/g, '—'],
    [/\u00E2\u20AC\u00A6/g, '…'],
    [/\u00E2\u20AC\u00A2/g, '•'],
    [/Â /g, ' '],
    [/Â(?=[,;:.!?])/g, ''],
  ];

  for (const [pattern, replacement] of replacements) {
    out = out.replace(pattern, replacement);
  }

  return out;
}

export function fixMojibakeString(value: string): string {
  const score = (s: string) => {
    const suspicious = (
      s.match(
        /[\u00C2\u00C3\u00E2\u0153\u0178\u0160\u0161\u017D\u017E\u2030]/g,
      ) ?? []
    ).length;
    const replacement = (s.match(/\uFFFD/g) ?? []).length;
    return suspicious * 2 + replacement * 10;
  };
  const currentScore = score(value);
  const targetedOriginal = applyTargetedMojibakeReplacements(value);
  const targetedOriginalScore = score(targetedOriginal);

  if (currentScore === 0 && targetedOriginal === value) return value;

  const windows1252ToBytes = (input: string): Uint8Array => {
    const map: Record<number, number> = {
      0x20ac: 0x80,
      0x201a: 0x82,
      0x0192: 0x83,
      0x201e: 0x84,
      0x2026: 0x85,
      0x2020: 0x86,
      0x2021: 0x87,
      0x02c6: 0x88,
      0x2030: 0x89,
      0x0160: 0x8a,
      0x2039: 0x8b,
      0x0152: 0x8c,
      0x017d: 0x8e,
      0x2018: 0x91,
      0x2019: 0x92,
      0x201c: 0x93,
      0x201d: 0x94,
      0x2022: 0x95,
      0x2013: 0x96,
      0x2014: 0x97,
      0x02dc: 0x98,
      0x2122: 0x99,
      0x0161: 0x9a,
      0x203a: 0x9b,
      0x0153: 0x9c,
      0x017e: 0x9e,
      0x0178: 0x9f,
    };
    const bytes: number[] = [];
    for (const ch of input) {
      const cp = ch.codePointAt(0) ?? 0;
      if (cp <= 0xff) {
        bytes.push(cp);
      } else if (map[cp] != null) {
        bytes.push(map[cp]);
      } else {
        bytes.push(0x3f);
      }
    }
    return Uint8Array.from(bytes);
  };

  const candidates = [
    Buffer.from(value, 'latin1').toString('utf8'),
    Buffer.from(windows1252ToBytes(value)).toString('utf8'),
    Buffer.from(targetedOriginal, 'latin1').toString('utf8'),
    Buffer.from(windows1252ToBytes(targetedOriginal)).toString('utf8'),
  ].filter((c) => typeof c === 'string' && c.length > 0);

  let best = targetedOriginalScore < currentScore ? targetedOriginal : value;
  let bestScore = Math.min(currentScore, targetedOriginalScore);
  for (const c of candidates) {
    const normalized = applyTargetedMojibakeReplacements(c);
    const normalizedScore = score(normalized);
    if (normalizedScore < bestScore) {
      best = normalized;
      bestScore = normalizedScore;
      continue;
    }
    const s = score(c);
    if (s < bestScore) {
      best = c;
      bestScore = s;
    }
  }
  return best;
}

function fixMojibakeDeepInternal(
  value: unknown,
  seen: WeakMap<object, unknown>,
): unknown {
  if (typeof value === 'string') {
    return fixMojibakeString(value);
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return seen.get(value);
    }
    const out: unknown[] = [];
    seen.set(value, out);
    for (const item of value) {
      out.push(fixMojibakeDeepInternal(item, seen));
    }
    return out;
  }
  if (value && typeof value === 'object') {
    if (seen.has(value as object)) {
      return seen.get(value as object);
    }
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    seen.set(value as object, out);
    Object.keys(obj).forEach((k) => {
      out[k] = fixMojibakeDeepInternal(obj[k], seen);
    });
    return out;
  }
  return value;
}

export function fixMojibakeDeep<T>(value: T): T {
  return fixMojibakeDeepInternal(value, new WeakMap()) as T;
}

export function readJsonFileWithFallback<T>(filePath: string): T {
  const raw = readTextFileWithFallback(filePath);
  const parsed = JSON.parse(raw) as T;
  return fixMojibakeDeep(parsed);
}
