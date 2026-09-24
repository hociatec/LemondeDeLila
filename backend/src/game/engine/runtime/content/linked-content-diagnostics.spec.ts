import { defineGameContent } from './game-content';
import { authoringPathOf } from '../contracts/authoring-origin';
import { GameContentValidationError } from '../contracts/game-domain.errors';
import { compileJsonGame } from '../definitions/json-game-compiler';
import { defineJsonEffectPack } from '../contracts/json-effect-pack';
import { authorObject } from '../contracts/json-author-schema';
import manifest from '../../../testing/fixtures/json-course/manifest.json';
import document from '../../../testing/fixtures/json-course/game.json';

it.each([
  [['free', { id: '', links: [] }], '[1].id'],
  [['free', { id: 'a', links: [] }, { id: 'a' }], '[2].id'],
  [['free', { id: 'a', links: ['a', 'missing'] }], '[1].links[1]'],
] as const)(
  'preserves original indices in a mixed linked collection %#',
  (tiles, field) => {
    let caught: unknown;
    try {
      defineGameContent('links', { 'board.tiles': tiles });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(GameContentValidationError);
    expect(authoringPathOf(caught)).toBe(
      `links.content["board.tiles"]${field}`,
    );
  },
);

it('maps a linked catalogue error back into its extension configuration', () => {
  const pack = defineJsonEffectPack({
    capabilities: [],
    scope: 'game-specific',
    domain: 'board',
    documentKey: 'links',
    outputKey: 'links',
    schema: authorObject({
      tiles: {
        type: 'array',
        items: authorObject({
          id: { type: 'string' },
          links: { type: 'array', items: { type: 'string' } },
        }),
      },
    }),
    compile: (program: { tiles: { id: string; links: string[] }[] }) => program,
  });
  expect(() =>
    compileJsonGame(
      manifest,
      {
        ...document,
        extensions: [
          {
            type: 'links',
            config: { tiles: [{ id: 'a', links: ['missing'] }] },
          },
        ],
      },
      undefined,
      {},
      [pack],
    ),
  ).toThrow(
    expect.objectContaining({
      code: 'GAME_AUTHORING_ERROR',
      path: 'game.json.extensions[0].config.tiles[0].links[0]',
      received: 'missing',
    }),
  );
});
