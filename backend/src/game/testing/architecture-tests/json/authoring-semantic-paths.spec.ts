import { compileJsonGame } from '../../../rules/public-api';
import { resolveJsonContent } from '../../../engine/runtime/content/json-content-bundle';
import {
  AuthoringError,
  authoringValueAt,
} from '../../../engine/runtime/contracts/authoring-error';
import propertyManifest from '../../../games/les-quatre-vents/sac-a-malices/manifest.json';
import propertyDocument from '../../../games/les-quatre-vents/sac-a-malices/game.json';
import propertyContent from '../../../games/les-quatre-vents/sac-a-malices/catalogue.json';
import quizManifest from '../../../games/les-quatre-vents/en-attendant-minuit/manifest.json';
import quizDocument from '../../../games/les-quatre-vents/en-attendant-minuit/game.json';
import quizContent from '../../../games/les-quatre-vents/en-attendant-minuit/catalogue.json';
import assemblyManifest from '../../../games/vents-dansants/pimp-my-ride/manifest.json';
import assemblyDocument from '../../../games/vents-dansants/pimp-my-ride/game.json';
import assemblyContent from '../../../games/vents-dansants/pimp-my-ride/content/catalogue.json';

const fixtures = {
  propertyEconomy: {
    manifest: propertyManifest,
    document: propertyDocument,
    content: propertyContent,
  },
  bounceQuizRace: {
    manifest: quizManifest,
    document: quizDocument,
    content: quizContent,
  },
  carAssembly: {
    manifest: assemblyManifest,
    document: assemblyDocument,
    content: assemblyContent,
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
  ['bounceQuizRace', 'trackId', 'missing'],
  ['bounceQuizRace', 'diceId', 'missing'],
  ['bounceQuizRace', 'deckId', 'missing'],
  ['bounceQuizRace', 'pawnSetId', 'missing'],
  ['bounceQuizRace', 'tiles[1].n', 999],
  ['bounceQuizRace', 'tiles[0].type', 'neutral'],
  ['carAssembly', 'deckId', 'missing'],
  ['carAssembly', 'handId', 'missing'],
  ['carAssembly', 'currentInventoryId', 'missing'],
  ['carAssembly', 'completedInventoryIds[1]', 'missing'],
  ['carAssembly', 'completedNameResources[1]', 'missing'],
  ['carAssembly', 'completedCountResource', 'missing'],
  ['carAssembly', 'carNameCounter', 'missing'],
  ['carAssembly', 'categoryOrder[1]', 'missing'],
];

describe.each([false, true])(
  'indexed semantic diagnostics (legacy=%s)',
  (legacy) => {
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
      const config = authoringValueAt(source, 'extensions[0].config');
      if (prepare) prepare(config);
      else replace(config, field, received);
      if (legacy) {
        Reflect.deleteProperty(source, 'extensions');
        Reflect.set(source, key, config);
      }
      let error: unknown;
      try {
        compileJsonGame(fixture.manifest, source);
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(AuthoringError);
      expect(error).toMatchObject({
        code: 'GAME_AUTHORING_ERROR',
        path: `game.json.${legacy ? key : 'extensions[0].config'}.${field}`,
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

    it('points to an out-of-range quiz answer', () => {
      check('bounceQuizRace', 'cards[0].quiz.correctIndex', 99, (config) => {
        replace(config, 'cards[0].quiz', {
          prompt: 'Question',
          choices: ['A', 'B', 'C'],
          correctIndex: 99,
          successDelta: 1,
          failureDelta: -1,
        });
      });
    });
  },
);
