const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve('src/game/games');
const parserPattern = /JSON\.parse\s*\(|(?:\.match|\.split)\s*\(|\bparseInt\s*\(|\bNumber\s*\(/;
const textPattern = /\b(description|text|label)\b/i;
const findings = [];

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(fullPath);
    else if (entry.isFile() && fullPath.endsWith('.ts') && !fullPath.endsWith('.spec.ts')) inspect(fullPath);
  }
}

function inspect(file) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!parserPattern.test(line)) return;
    const context = lines.slice(Math.max(0, index - 2), index + 3).join(' ');
    if (textPattern.test(context)) findings.push(`${path.relative(process.cwd(), file)}:${index + 1}`);
  });
}

visit(root);
if (findings.length > 0) {
  console.error(`Game text parsing detected:\n${findings.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('Game text parser audit: 0 violations');
}
