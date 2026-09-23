import { Logger } from '@nestjs/common';
import { createJsonGameCompiler } from '../../../engine/runtime/definitions/json-game-compiler-factory';
import { testGame } from '../../../engine/testing/public-api';
import manifest from '../../../testing/fixtures/json-course/manifest.json';
import { effectPack } from './effect-pack';
import type { ResourceTrackRaceProgram } from './program';

const program: ResourceTrackRaceProgram = {
  trackId: 'route',
  diceId: 'main',
  finishReason: 'arrival',
  tiles: Array.from({ length: 21 }, (_, n) => ({
    n,
    title: 'Sector',
    description: '',
    type: 'sector',
  })),
  faces: ['charge', 'charge'],
  resources: { fuel: 'fuel', cargo: 'cargo' },
  dangerCounter: 'surge',
  resolvedEvent: 'expedition.roll',
  eventNamespace: 'expedition',
  mechanics: {
    rerollValues: [],
    rerollLimit: 0,
    advance: 3,
    faceGains: {
      charge: [{ resources: ['fuel'], amount: 4, select: 'first' }],
    },
    tileRules: [
      {
        position: 3,
        gains: { cargo: 7 },
        setCounter: { id: 'surge', value: 1 },
      },
    ],
    dangerFaces: ['charge'],
    dangerDistance: 2,
    amplifiedDistance: 3,
    extraDistance: { '3': 1 },
    ranking: [['cargo'], ['fuel']],
  },
};
const compiler = createJsonGameCompiler([effectPack]);
const document = (source: ResourceTrackRaceProgram) => ({
  schemaVersion: 1,
  contentVersion: '1',
  definitionVersion: '1',
  category: 'test',
  world: 'examples',
  patterns: [{ kind: 'race', trackId: 'route', spaces: 21, diceSides: 2 }],
  components: [],
  resourceIds: ['fuel', 'cargo'],
  setup: { resources: { fuel: 0, cargo: 0 }, counters: { surge: 0 } },
  initialPhase: 'playing',
  phases: { playing: { actions: ['roll'], terminal: true } },
  actions: { roll: { recipe: 'race-resource-track-roll' } },
  victory: { kind: 'by-resource-track-race' },
  resourceTrackRace: source,
});
beforeAll(() =>
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {}),
);
afterAll(() => jest.restoreAllMocks());

it('uses arbitrary faces, resources, landing gains and combined movement distances', async () => {
  const game = testGame(compiler.compileJsonGame(manifest, document(program)))
    .players(2)
    .seed(42);
  await game.start();
  await game.as(1).do('roll', {});
  expect(game.resource(1, 'fuel')).toBe(4);
  expect(game.resource(1, 'cargo')).toBe(7);
  expect(game.inspect.positions('route')).toEqual({ '1': 9, '2': 6 });
  await game.as(2).do('roll', {});
  // The amplification was consumed; the second actor lands on an ordinary tile.
  expect(game.inspect.positions('route')).toEqual({ '1': 11, '2': 11 });
  expect(game.resource(2, 'cargo')).toBe(0);
  expect(await game.replay()).toEqual(game.state());
});

it('caps configured resource losses at the available amount', async () => {
  const source = structuredClone(program);
  source.mechanics.tileRules = [{ position: 3, gains: { fuel: -9 } }];
  source.mechanics.dangerFaces = [];
  const game = testGame(
    compiler.compileJsonGame(manifest, document(source)),
  ).players(2);
  await game.start();
  await game.as(1).do('roll', {});
  expect(game.resource(1, 'fuel')).toBe(0);
  expect(game.inspect.positions('route')['1']).toBe(3);
});

it('does not emit a resource change when a loss targets an empty balance', async () => {
  const source = structuredClone(program);
  source.mechanics.faceGains = { charge: [] };
  source.mechanics.tileRules = [{ position: 3, gains: { fuel: -9 } }];
  source.mechanics.dangerFaces = [];
  const game = testGame(
    compiler.compileJsonGame(manifest, document(source)),
  ).players(2);
  await game.start();
  await game.as(1).do('roll', {});
  expect(game.resource(1, 'fuel')).toBe(0);
  expect(
    (await game.events()).filter(
      (event) =>
        event.type === 'resource.changed' && event.data.actionType === 'roll',
    ),
  ).toEqual([]);
  expect(await game.replay()).toEqual(game.state());
});

it.each(['face', 'resource', 'counter', 'position'])(
  'rejects an unknown %s before starting',
  (reference) => {
    const source = structuredClone(program);
    if (reference === 'face') source.mechanics.dangerFaces = ['absent'];
    if (reference === 'resource') source.mechanics.ranking = [['absent']];
    if (reference === 'counter') source.dangerCounter = 'absent';
    if (reference === 'position') source.mechanics.extraDistance = { '21': 3 };
    expect(() => compiler.compileJsonGame(manifest, document(source))).toThrow(
      /unknown/,
    );
  },
);
