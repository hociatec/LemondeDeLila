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
      '1770800000000-EnforceSingleActiveGameMatch.ts',
    );
  });

  it('keeps the initial schema creation and teardown dependency-ordered', () => {
    const source = readFileSync(
      join(directory, '1734800000000-InitSchema.ts'),
      'utf8',
    );
    const created = [
      ...source.matchAll(
        /name: '(users|chat_messages|messaging_private_messages|rooms|room_participants|room_bots|bot_names)'/g,
      ),
    ]
      .map((match) => match[1])
      .filter((name, index, all) => all.indexOf(name) === index);
    const dropped = [...source.matchAll(/dropTable\('(.*?)'/g)].map(
      (match) => match[1],
    );
    expect(created).toEqual([
      'users',
      'chat_messages',
      'messaging_private_messages',
      'rooms',
      'room_participants',
      'room_bots',
      'bot_names',
    ]);
    expect(dropped).toEqual([...created].reverse());
  });
});
