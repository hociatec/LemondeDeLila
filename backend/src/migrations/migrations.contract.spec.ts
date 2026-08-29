import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

describe('database migrations contract', () => {
  const directory = __dirname;
  const files = readdirSync(directory)
    .filter((file) => /^\d{13}-.*\.ts$/.test(file))
    .sort();

  it('keeps a unique, ordered migration history with reversible contracts', () => {
    expect(files.length).toBeGreaterThan(30);
    const timestamps = files.map((file) => file.slice(0, 13));
    expect(new Set(timestamps).size).toBe(timestamps.length);
    for (const file of files) {
      const source = readFileSync(join(directory, file), 'utf8');
      expect(source).toMatch(/implements MigrationInterface/);
      expect(source).toMatch(/async up\s*\(/);
      expect(source).toMatch(/async down\s*\(/);
      expect(source).not.toMatch(/pg_advisory|::jsonb|RETURNING\s+/i);
    }
  });

  it('places the newest migrations after the game-session baseline', () => {
    expect(basename(files.at(-1) ?? '')).toBe(
      '1770600000000-AuditHotQueryIndexes.ts',
    );
  });
});
