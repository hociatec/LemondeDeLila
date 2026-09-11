const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve('src/game/games');
const violations = [];
let contentFiles = 0;
function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(file);
    else if (entry.name === 'content.ts') {
      contentFiles += 1;
      const source = fs.readFileSync(file, 'utf8');
      if (!source.includes('defineGameContent')) violations.push(`${file}: missing defineGameContent`);
      if (/JSON\.parse\s*\(|(?:description|text|label)\s*\.\s*(?:match|split)\s*\(/.test(source))
        violations.push(`${file}: executable rule encoded in text`);
    }
  }
}
visit(root);
if (contentFiles === 0 || violations.length) {
  console.error(`Game content structure audit failed: ${violations.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log(`Game content structure audit: ${contentFiles} structured content modules`);
}
