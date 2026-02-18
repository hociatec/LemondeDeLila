const fs = require('fs');
const path = require('path');

function suspiciousScore(input) {
  const needles = [
    '\u00c3', // Ã
    '\u00c2', // Â
    '\u00e2\u20ac', // â€
    '\u00ef\u00bb\u00bf', // ï»¿
    '\ufffd', // replacement char
  ];
  let score = 0;
  for (const needle of needles) {
    let from = 0;
    while (true) {
      const idx = input.indexOf(needle, from);
      if (idx < 0) break;
      score += needle === '\ufffd' ? 10 : 2;
      from = idx + needle.length;
    }
  }
  return score;
}

function decodeLatin1(input) {
  return Buffer.from(input, 'latin1').toString('utf8');
}

function bestFix(input) {
  let best = input;
  let bestScore = suspiciousScore(input);
  let candidate = input;
  for (let i = 0; i < 3; i += 1) {
    candidate = decodeLatin1(candidate);
    const score = suspiciousScore(candidate);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return { text: best, score: bestScore };
}

const files = process.argv.slice(2).filter(Boolean);
let changed = 0;

for (const relPath of files) {
  const filePath = path.resolve(relPath);
  if (!fs.existsSync(filePath)) continue;
  const original = fs.readFileSync(filePath, 'utf8');
  const before = suspiciousScore(original);
  if (before === 0) continue;
  const fixed = bestFix(original);
  if (fixed.score >= before) continue;
  fs.writeFileSync(filePath, fixed.text, 'utf8');
  changed += 1;
  process.stdout.write(`fixed: ${relPath} (${before} -> ${fixed.score})\n`);
}

process.stdout.write(`changed_files=${changed}\n`);
