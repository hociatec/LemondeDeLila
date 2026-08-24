const fs = require('node:fs');
const path = require('node:path');
const { TextDecoder } = require('node:util');

const WINDOWS_1252_BYTES = new Map([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84],
  [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
  [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
  [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
  [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f],
]);

const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

function suspiciousScore(input) {
  const needles = [
    '\u00c3',
    '\u00c2',
    '\u00e2\u20ac',
    '\u00ef\u00bb\u00bf',
    '\ufffd',
  ];
  let score = 0;
  for (const needle of needles) {
    let from = 0;
    while (true) {
      const index = input.indexOf(needle, from);
      if (index < 0) break;
      score += needle === '\ufffd' ? 10 : 2;
      from = index + needle.length;
    }
  }
  return score;
}

function decodeWindows1252(input) {
  const bytes = [];
  for (const character of input) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0xff) {
      bytes.push(codePoint);
      continue;
    }
    const byte = WINDOWS_1252_BYTES.get(codePoint);
    if (byte === undefined) return undefined;
    bytes.push(byte);
  }
  try {
    return utf8Decoder.decode(Uint8Array.from(bytes));
  } catch {
    return undefined;
  }
}

function bestFixRun(input) {
  let best = input;
  let bestScore = suspiciousScore(input);
  if (bestScore === 0) return input;

  let candidate = input;
  for (let pass = 0; pass < 4; pass += 1) {
    candidate = decodeWindows1252(candidate);
    if (candidate === undefined) break;
    const score = suspiciousScore(candidate);
    if (score <= bestScore && candidate.length < best.length) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function bestFix(input) {
  // In a few historical files, the final byte of `à` was irreversibly turned
  // into an ASCII space. The surrounding extra space makes this sequence
  // unambiguous (`ÃƒÂ ` followed by the original separator).
  const repairedLossySequences = input
    .replace(/\u00c3\u0192\u00c2 /gu, 'à')
    .replace(/\u00c3\u00c2([\u00a0-\u00bf])/gu, (_match, continuation) =>
      utf8Decoder.decode(
        Uint8Array.from([0xc3, continuation.codePointAt(0)]),
      ),
    )
    .replace(/\u00c3 (?= )/gu, 'à')
    .replace(/\u00c3\u00e2\u20ac\u00b0/gu, 'É')
    .replace(/\u00e2\u20ac\u00e2\u201e\u00a2/gu, '’')
    .replace(/\u00c2\u2019/gu, '’');
  return repairedLossySequences.replace(/[^\r\n]+/gu, (line) => {
    const fixedLine = bestFixRun(line);
    return fixedLine.replace(/[^\x00-\x7f]+/gu, (run) => bestFixRun(run));
  });
}

function collectFiles(root) {
  const files = [];
  const visit = (entryPath) => {
    const stat = fs.statSync(entryPath);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(entryPath)) visit(path.join(entryPath, entry));
      return;
    }
    if (/\.(?:ts|json|cjs|mjs|js)$/i.test(entryPath)) files.push(entryPath);
  };
  visit(path.resolve(root));
  return files;
}

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const rootArg = args.find((arg) => arg.startsWith('--root='));
const explicitFiles = args.filter(
  (arg) => arg !== '--check' && !arg.startsWith('--root='),
);
const files = rootArg
  ? collectFiles(rootArg.slice('--root='.length))
  : explicitFiles.map((file) => path.resolve(file));

if (files.length === 0) {
  process.stderr.write(
    'usage: node tools/fix-mojibake-files.cjs [--check] (--root=<dir> | <files...>)\n',
  );
  process.exitCode = 1;
} else {
  let changed = 0;
  let unresolved = 0;
  for (const filePath of files) {
    if (!fs.existsSync(filePath)) continue;
    const original = fs.readFileSync(filePath, 'utf8');
    const before = suspiciousScore(original);
    if (before === 0) continue;
    const fixed = bestFix(original);
    const after = suspiciousScore(fixed);
    if (fixed !== original && after < before) {
      if (!checkOnly) fs.writeFileSync(filePath, fixed, 'utf8');
      changed += 1;
      process.stdout.write(
        `${checkOnly ? 'would fix' : 'fixed'}: ${path.relative(process.cwd(), filePath)} (${before} -> ${after})\n`,
      );
    }
    if (after > 0) unresolved += 1;
  }
  process.stdout.write(
    `${checkOnly ? 'changeable' : 'changed'}_files=${changed} unresolved_files=${unresolved}\n`,
  );
}
