const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const sourceRoot = path.resolve(__dirname, '..', 'src');

test('forbids definite assignment assertions on local variables', () => {
  const violations = productionTypescriptFiles(sourceRoot).filter((file) =>
    /\b(?:let|const|var)\s+[A-Za-z_$][\w$]*!\s*:/.test(
      fs.readFileSync(file, 'utf8'),
    ),
  );
  assert.deepEqual(
    violations.map((file) =>
      path.relative(sourceRoot, file).replaceAll('\\', '/'),
    ),
    [],
  );
});

function productionTypescriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return productionTypescriptFiles(target);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')
      ? [target]
      : [];
  });
}
