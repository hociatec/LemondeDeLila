import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readInstalledGameCatalog } from './filesystem-game-catalog.reader';

describe('installed game catalogue', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'lila-installed-games-'));
    mkdirSync(join(root, 'world/example'), { recursive: true });
    writeFileSync(
      join(root, 'world/example/manifest.json'),
      JSON.stringify({
        code: 'example',
        engine: 'example',
        name: 'Example',
        minPlayers: 2,
        maxPlayers: 4,
      }),
    );
    writeFileSync(join(root, 'world/example/rules.md'), 'Rules');
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('reads only packages selected by build composition and ignores unregistered directories', () => {
    mkdirSync(join(root, 'unknown'));
    writeFileSync(join(root, 'unknown/manifest.json'), '{invalid');
    const entries = readInstalledGameCatalog(root, [
      { code: 'example', directory: 'world/example' },
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      manifest: { code: 'example', engine: 'example' },
      rulesPath: join(root, 'world/example/rules.md'),
    });
  });

  it('fails when a package from the compiled index is missing', () => {
    expect(() =>
      readInstalledGameCatalog(root, [
        { code: 'missing', directory: 'world/missing' },
      ]),
    ).toThrow('Package de jeu absent');
  });

  it('rejects replacement of the manifest identity', () => {
    writeFileSync(
      join(root, 'world/example/manifest.json'),
      JSON.stringify({ code: 'other' }),
    );
    expect(() =>
      readInstalledGameCatalog(root, [
        { code: 'example', directory: 'world/example' },
      ]),
    ).toThrow('Manifeste de catalogue invalide');
  });

  it.each(['../example', '/example', 'C:/example', 'world/other'])(
    'rejects an invalid generated location: %s',
    (directory) => {
      expect(() =>
        readInstalledGameCatalog(root, [{ code: 'example', directory }]),
      ).toThrow('Index de catalogue invalide');
    },
  );
});
