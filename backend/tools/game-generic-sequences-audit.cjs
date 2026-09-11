const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve('src/game/games');
const categories = {
  cards: /(?:ctx\.cards|drawAndResolve|drawCourse|ctx\.choice\.(?:card|one|many))/g,
  players: /ctx\.players\.(?:next|previous|other|others|current|random|all)/g,
  movement: /ctx\.movement\./g,
  turns: /ctx\.turn\./g,
  exchange: /ctx\.(?:inventory|cards)\.(?:exchange|transfer|swap|steal)/g,
  scoring: /ctx\.score\./g,
  setup: /(?:ctx\.inventory\.add|ctx\.round\.start|ctx\.pawns\.)/g,
  victory: /ctx\.match\.finish/g,
};
const counts = Object.fromEntries(Object.keys(categories).map((key) => [key, 0]));
let files = 0;

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(fullPath);
    else if (entry.isFile() && fullPath.endsWith('.ts') && !fullPath.endsWith('.spec.ts')) {
      files += 1;
      const source = fs.readFileSync(fullPath, 'utf8');
      for (const [category, pattern] of Object.entries(categories))
        counts[category] += source.match(pattern)?.length ?? 0;
    }
  }
}

visit(root);
if (files === 0 || Object.values(counts).some((count) => count === 0)) {
  console.error(`Generic game sequence audit failed: ${JSON.stringify({ files, counts })}`);
  process.exitCode = 1;
} else {
  console.log(`Generic game sequence audit: ${files} files; ${JSON.stringify(counts)}`);
}
