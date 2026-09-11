import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

it('keeps the reviewed migration history immutable and independent of current business modules', () => {
  const ledger: Record<string, string> = JSON.parse(
    readFileSync(
      resolve(__dirname, '../../../../tools/migration-history.json'),
      'utf8',
    ),
  );
  const files = readdirSync(__dirname)
    .filter((name) => /^\d{13}-.*\.ts$/.test(name))
    .sort();
  expect(Object.keys(ledger).sort()).toEqual(files);
  for (const filename of files) {
    const source = readFileSync(join(__dirname, filename), 'utf8').replace(
      /\r\n/g,
      '\n',
    );
    expect({
      filename,
      sha256: createHash('sha256').update(source).digest('hex'),
    }).toEqual({ filename, sha256: ledger[filename] });
    const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(
      (match) => match[1],
    );
    expect(
      imports.every((name) =>
        ['typeorm', 'fs', 'path', 'node:fs', 'node:path'].includes(name),
      ),
    ).toBe(true);
  }
});
