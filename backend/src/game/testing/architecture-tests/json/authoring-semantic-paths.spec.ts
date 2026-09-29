import { compileJsonGame } from '../../../rules/public-api';
import { resolveJsonContent } from '../../../engine/runtime/content/json-content-bundle';
import {
  AuthoringError,
  authoringValueAt,
} from '../../../engine/runtime/contracts/authoring-error';
import propertyManifest from '../../../games/les-quatre-vents/sac-a-malices/manifest.json';
import propertyDocument from '../../../games/les-quatre-vents/sac-a-malices/game.json';
import propertyContent from '../../../games/les-quatre-vents/sac-a-malices/catalogue.json';

const fixtures = {
  propertyEconomy: {
    manifest: propertyManifest,
    document: propertyDocument,
    content: propertyContent,
  },
};

function record(value: unknown): object {
  if (value === null || typeof value !== 'object')
    throw new Error('Invalid fixture path');
  return value;
}

function replace(value: unknown, path: string, replacement: unknown): void {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  const key = parts.pop();
  if (key === undefined) throw new Error('Missing fixture key');
  Reflect.set(
    record(authoringValueAt(value, parts.join('.'))),
    key,
    replacement,
  );
}

type Case = readonly [keyof typeof fixtures, string, unknown];
const cases: Case[] = [
  ['propertyEconomy', 'defaultVariantId', 'missing'],
  ['propertyEconomy', 'variants[1].id', propertyContent.variants[0].id],
  [
    'propertyEconomy',
    'variants[0].tiles[1].id',
    propertyContent.variants[0].tiles[0].id,
  ],
  ['propertyEconomy', 'variants[0].tiles[1].n', 999],
  ['propertyEconomy', 'variants[0].tiles[0].type', 'neutral'],
  ['propertyEconomy', 'variants[0].rules.jail.tileId', 'missing'],
  ['propertyEconomy', 'variants[0].groups[0].propertyIds[0]', 'missing'],
  [
    'propertyEconomy',
    'variants[0].groups[1].id',
    propertyContent.variants[0].groups[0].id,
  ],
  ['propertyEconomy', 'variants[0].groups[0].propertyIds', []],
  ['propertyEconomy', 'variants[0].tiles[0].groupId', 'missing'],
  ['propertyEconomy', 'variants[0].stations.propertyIds[0]', 'missing'],
  ['propertyEconomy', 'variants[0].utilities[0].tileId', 'missing'],
  [
    'propertyEconomy',
    'variants[0].community[0].id',
    propertyContent.variants[0].chance[0].id,
  ],
];

describe('indexed native-pattern semantic diagnostics', () => {
  function check(
    key: keyof typeof fixtures,
    field: string,
    received: unknown,
    prepare?: (config: unknown) => void,
  ) {
    const fixture = fixtures[key];
    const resolved = resolveJsonContent(fixture.document, {
      'content/catalogue.json': fixture.content,
    });
    const source = record(structuredClone(resolved));
    const config = authoringValueAt(source, 'patterns[0].config');
    if (prepare) prepare(config);
    else replace(config, field, received);
    let error: unknown;
    try {
      compileJsonGame(fixture.manifest, source);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(AuthoringError);
    expect(error).toMatchObject({
      code: 'GAME_AUTHORING_ERROR',
      path: `game.json.patterns[0].config.${field}`,
      received,
    });
  }

  it.each(cases)(
    '%s identifies %s and its received value',
    (key, field, value) => check(key, field, value),
  );

  it('points into a custom movement nested inside a card', () => {
    check(
      'propertyEconomy',
      'variants[0].chance[0].effects[0].data.movement.tileId',
      'missing',
      (config) => {
        replace(config, 'variants[0].chance[0].effects', [
          {
            kind: 'custom',
            effectId: 'board-property-economy.movement',
            data: {
              movement: {
                kind: 'tile',
                tileId: 'missing',
                direction: 'forward',
              },
            },
          },
        ]);
      },
    );
  });
});
