import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverGameDefinitions } from './game-module-discovery';

describe('game module discovery', () => {
  it('discovers every TypeScript game definition directly', () => {
    const definitions = discoverGameDefinitions();
    expect(definitions.map((definition) => definition.id)).toContain('morpion');
    expect(definitions.map((definition) => definition.id)).toContain(
      'dame-nature',
    );
  });

  it('discovers game.js entry points without a registry or Nest module', () => {
    const root = mkdtempSync(join(tmpdir(), 'lila-game-discovery-'));
    try {
      writeDefinition(root, 'zeta', 'zeta');
      writeDefinition(root, 'alpha', 'alpha');
      writeFileSync(join(root, 'ignored.js'), definitionSource('ignored'));

      const definitions = discoverGameDefinitions(root, 'game.js');

      expect(definitions.map((definition) => definition.id)).toEqual([
        'alpha',
        'zeta',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function writeDefinition(root: string, folder: string, id: string): void {
  const target = join(root, folder);
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, 'game.js'), definitionSource(id));
}

function definitionSource(id: string): string {
  return `module.exports.default = {
    kind: 'lila.game-definition',
    id: '${id}',
    displayName: '${id}',
    category: 'test',
    players: { min: 2, max: 4 },
    setup: () => ({}),
    actions: { pass: {} },
    view: () => ({})
  };`;
}
