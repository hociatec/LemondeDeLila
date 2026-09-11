import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { getMetadataArgsStorage } from 'typeorm';
import { ORM_ENTITIES } from './typeorm-entities';

function entityClasses(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = join(directory, entry.name);
    if (entry.isDirectory()) return entityClasses(filename);
    if (!entry.name.endsWith('.entity.ts')) return [];
    const location = relative(join(__dirname, '../..'), filename).replaceAll(
      '\\',
      '/',
    );
    expect(location).toMatch(
      /^(?:modules\/[^/]+|game\/(?:core|engine)|platform\/[^/]+)\/infrastructure\/persistence\/typeorm\/entities\/[^/]+\.entity\.ts$/,
    );
    const source = readFileSync(filename, 'utf8');
    return [...source.matchAll(/export class (\w+)/g)].map((match) => match[1]);
  });
}

it('registers every persisted entity exactly once at the composition root', () => {
  const names = ORM_ENTITIES.map((entity) => entity.name);
  expect(new Set(names).size).toBe(names.length);
  expect(names.sort()).toEqual(entityClasses(join(__dirname, '../..')).sort());
});

it('assigns each physical table to exactly one registered entity', () => {
  const registered = new Set<unknown>(ORM_ENTITIES);
  const tables = getMetadataArgsStorage().tables.filter((table) =>
    registered.has(table.target),
  );
  expect(tables).toHaveLength(ORM_ENTITIES.length);
  const owners = new Map<string, unknown>();
  for (const table of tables) {
    expect(typeof table.name).toBe('string');
    expect(table.name).not.toBe('');
    const identity = `${table.database ?? ''}/${table.schema ?? ''}/${table.name}`;
    expect(owners.has(identity)).toBe(false);
    owners.set(identity, table.target);
  }
});
