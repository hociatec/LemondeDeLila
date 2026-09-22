import { Logger } from '@nestjs/common';
import { discoverGameDefinitions } from '../../../composition/game-module-discovery';
import { isGameDefinition } from '../../../engine/runtime/definitions/game-definition';
const packages = discoverGameDefinitions().map((definition) => ({
  definition,
  manifest: {
    code: definition.id,
    engine: definition.id,
    name: definition.displayName,
    summary: definition.description ?? '',
    minPlayers: definition.players.min,
    maxPlayers: definition.players.max,
  },
}));
import { compileJsonGame } from '../../../rules/public-api';
import { runGameReplayCampaign } from './game-replay-campaign';

type Data = Record<string, unknown>;
function object(value: unknown): Data {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected a configuration object');
  return value as Data;
}
function list(value: unknown): Data[] {
  if (!Array.isArray(value)) throw new Error('Expected configuration entries');
  return value.map(object);
}
function rename(value: unknown, names: Record<string, string>): unknown {
  if (typeof value === 'string') return names[value] ?? value;
  if (Array.isArray(value)) return value.map((item) => rename(item, names));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        names[key] ?? key,
        key === 'kind' ? item : rename(item, names),
      ]),
    );
  return value;
}
function renamedCategories(program: Data, field: string): Data {
  const names = Object.fromEntries(
    list(program[field]).map((card) => [
      String(card.category),
      `category-${String(card.category)}`,
    ]),
  );
  return object(rename(program, names));
}
function renamedTiles(program: Data): Data {
  const names = Object.fromEntries(
    Object.keys(object(program.tileRules)).map((key, i) => [key, `zone-${i}`]),
  );
  return {
    ...program,
    tiles: list(program.tiles).map((tile) => ({
      ...tile,
      type: names[String(tile.type)],
    })),
    tileRules: Object.fromEntries(
      Object.entries(object(program.tileRules)).map(([key, rule]) => [
        names[key],
        rule,
      ]),
    ),
  };
}
const variants: Record<string, (program: Data) => Data> = {
  anonymousVote: (program) => ({
    ...program,
    challenges: list(program.challenges).map((challenge) => ({
      ...challenge,
      answers: ['First', 'Second', 'Third', 'Fourth', 'Fifth'],
    })),
  }),
  chapterEncounter: (program) =>
    object(
      rename(
        program,
        Object.fromEntries(
          (program.collectionKinds as string[]).map((key, i) => [
            key,
            `archive-${i}`,
          ]),
        ),
      ),
    ),
  bidirectionalCollisionRace: (program) => ({
    ...program,
    tiles: list(program.tiles).map((tile) => ({
      ...tile,
      region: `region-${String(tile.region)}`,
    })),
  }),
  protectedHauntedRace: (program) => ({
    ...renamedCategories(program, 'cards'),
    conditionalMove: { equals: 2, delta: -3 },
  }),
  resourceTrackRace: (program) => ({
    ...program,
    mechanics: {
      ...object(program.mechanics),
      advance: 2,
      rerollValues: [],
      dangerDistance: 2,
    },
  }),
  themeNameCards: (program) => ({
    ...object(
      rename(
        program,
        Object.fromEntries(
          list(program.specialRules).flatMap((rule, i) => [
            [String(rule.id), `ability-${i}`],
            [String(rule.effectId), `custom.ability-${i}`],
          ]),
        ),
      ),
    ),
    handSize: 7,
    redrawCount: 2,
  }),
  publicDomainCards: (program) => renamedCategories(program, 'cards'),
  ritualPhases: (program) => ({
    ...program,
    initialHandSize: 4,
    exchangeFamilyCount: 2,
  }),
  sharedPrestigeCards: (program) => ({
    ...renamedCategories(program, 'cards'),
    mechanics: {
      ...object(renamedCategories(program, 'cards').mechanics),
      gainDivisor: 3,
    },
  }),
  chainedTileRace: renamedTiles,
  pairedPawnRace: (program) => ({
    ...renamedTiles(program),
    rollMinimum: 2,
    rollAdvance: 3,
  }),
  gooseRace: renamedTiles,
  storyChallenge: (program) =>
    object(
      rename(
        program,
        Object.fromEntries(
          [
            ...Object.keys(object(program.decks)),
            ...Object.keys(object(program.targetRules)),
            ...Object.keys(object(program.optionRules)),
          ].map((key, i) => [key, `rule-${i}`]),
        ),
      ),
    ),
  directionalHazardRace: (program) => ({
    ...program,
    parameters: {
      ...object(program.parameters),
      checkpointSpan: 3,
      idleThreshold: 3,
      randomSides: 4,
    },
  }),
  treasureTrackRace: (program) =>
    object(
      rename(renamedTiles(program), {
        treasure: 'samples',
        obstacle: 'hazards',
        bonus: 'supplies',
      }),
    ),
  teamPawnRace: (program) => ({
    ...program,
    entryRolls: [1, 3],
    extraTurnRolls: [2],
    startPositions: [...(program.startPositions as number[])].reverse(),
  }),
};

beforeAll(() =>
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {}),
);
afterAll(() => jest.restoreAllMocks());

describe('mechanisms run under an unrelated game identity', () => {
  it.each(
    packages.map(({ manifest, definition }) => ({ manifest, definition })),
  )(
    '$manifest.code',
    ({ manifest, definition }) => {
      const document = structuredClone(object(definition.content?.data));
      const changed = Object.keys(variants).filter((key) => document[key]);
      for (const key of changed) {
        const program = object(document[key]);
        document[key] = variants[key](program);
        let names: Record<string, string> = {};
        if (key === 'chapterEncounter')
          names = Object.fromEntries(
            (program.collectionKinds as string[]).flatMap((kind, i) => [
              [kind, 'archive-' + i],
              [
                String(program.collectionResourcePrefix) + kind,
                String(program.collectionResourcePrefix) + 'archive-' + i,
              ],
            ]),
          );
        if (key === 'bidirectionalCollisionRace')
          names = Object.fromEntries(
            list(program.tiles).map((tile) => [
              String(tile.region),
              'region-' + String(tile.region),
            ]),
          );
        if (key === 'sharedPrestigeCards')
          names = Object.fromEntries(
            list(program.cards).map((card) => [
              String(card.category),
              'category-' + String(card.category),
            ]),
          );
        if (key === 'treasureTrackRace')
          names = {
            treasure: 'samples',
            obstacle: 'hazards',
            bonus: 'supplies',
          };
        if (key === 'chainedTileRace' || key === 'pairedPawnRace')
          names = Object.fromEntries(
            Object.keys(object(program.tileRules)).map((kind, i) => [
              kind,
              'zone-' + i,
            ]),
          );
        document.components = rename(document.components, names);
        document.resourceIds = rename(document.resourceIds, names);
        document.setup = rename(document.setup, names);
        if (
          key === 'chainedTileRace' ||
          key === 'pairedPawnRace' ||
          key === 'bidirectionalCollisionRace'
        )
          object(document[key]).cards = rename(program.cards, names);
      }
      if (document.grid)
        object(document.grid).markEvent = 'mechanism-fixture.mark';
      const other: unknown = compileJsonGame(
        {
          ...manifest,
          code: 'mechanism-fixture',
          engine: 'mechanism-fixture',
          name: 'Mechanism fixture',
        },
        document,
      );
      if (!isGameDefinition(other)) throw new Error('Compilation failed');
      expect(other.id).toBe('mechanism-fixture');
      for (const key of changed)
        expect(document[key]).not.toEqual(
          object(definition.content?.data)[key],
        );
      expect(runGameReplayCampaign(other, 17, 8).steps).toBeGreaterThan(0);
    },
    120000,
  );
});

it('exercises every newly configurable profile in the variant matrix', () => {
  const used = new Set(
    packages.flatMap(({ definition }) =>
      Object.keys(object(definition.content?.data)),
    ),
  );
  expect(Object.keys(variants).filter((key) => !used.has(key))).toEqual([]);
});
