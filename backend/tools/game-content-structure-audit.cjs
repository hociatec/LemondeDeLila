const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve('src/game/games');
const violations = [];
let contentFiles = 0;

function visit(directory) {
  const entries = fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name, 'en'));
  const names = new Set(entries.map((entry) => entry.name));
  if (names.has('manifest.json')) {
    if (!names.has('game.json'))
      violations.push(`${directory}: missing game.json`);
    if (names.has('game.ts') || names.has('content.ts'))
      violations.push(`${directory}: legacy executable game content`);
  }
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(file);
    else if (entry.name === 'game.json') {
      contentFiles += 1;
      let document;
      try {
        document = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch {
        violations.push(`${file}: invalid JSON`);
        continue;
      }
      if (document.schemaVersion !== 1)
        violations.push(`${file}: missing declarative schemaVersion`);
      if (!document.actions || typeof document.actions !== 'object')
        violations.push(`${file}: missing declarative actions`);
    }
  }
}

visit(root);
if (contentFiles !== 39 || violations.length) {
  console.error(
    `Game content structure audit failed: ${violations.join(', ')}; packages=${contentFiles}`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `Game content structure audit: ${contentFiles} structured content modules`,
  );
}
