import { compileJsonGame } from '../../../rules/public-api';
import {
  AuthoringError,
  authoringValueAt,
} from '../../../engine/runtime/contracts/authoring-error';
import { authoringProperty } from '../../../engine/runtime/contracts/authoring-diagnostics';
import { fixture, object, type Data } from './extension-diagnostic-fixture';

function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Expected array');
  return value;
}
function tiles(p: Data) {
  return list(p.tiles).map(object);
}
function mechanics(p: Data) {
  return object(p.mechanics);
}
type Case = { key: string; change: (p: Data) => string };
const resourceCases: Array<(p: Data) => string> = [
  (p) => {
    object(p.resources)['source.with.dot'] = 'absent';
    return 'resources["source.with.dot"]';
  },
  (p) => {
    const face = String(list(p.faces)[0]);
    delete object(mechanics(p).faceGains)[face];
    return authoringProperty('mechanics.faceGains', face);
  },
  (p) => {
    object(mechanics(p).faceGains)['unknown.face'] = [];
    return 'mechanics.faceGains["unknown.face"]';
  },
  (p) => {
    const face = String(list(p.faces)[0]);
    object(mechanics(p).faceGains)[face] = [
      { resources: ['absent'], amount: 1, select: 'first' },
    ];
    return authoringProperty('mechanics.faceGains', face) + '[0].resources[0]';
  },
  (p) => {
    mechanics(p).dangerFaces = ['absent'];
    return 'mechanics.dangerFaces[0]';
  },
  (p) => {
    mechanics(p).rerollValues = [list(p.faces).length + 1];
    return 'mechanics.rerollValues[0]';
  },
  (p) => {
    mechanics(p).tileRules = [{ position: tiles(p).length, gains: {} }];
    return 'mechanics.tileRules[0].position';
  },
  (p) => {
    mechanics(p).tileRules = [{ position: 0, gains: {}, faces: ['absent'] }];
    return 'mechanics.tileRules[0].faces[0]';
  },
  (p) => {
    mechanics(p).tileRules = [{ position: 0, gains: { 'a["b"]': 1 } }];
    return 'mechanics.tileRules[0].gains["a[\\"b\\"]"]';
  },
  ...(['left', 'right'] as const).map((side) => (p: Data) => {
    const valid = Object.values(object(p.resources))[0];
    mechanics(p).tileRules = [
      {
        position: 0,
        gains: {},
        greaterResource: { left: valid, right: valid, [side]: 'absent' },
      },
    ];
    return `mechanics.tileRules[0].greaterResource.${side}`;
  }),
  (p) => {
    mechanics(p).tileRules = [
      { position: 0, gains: {}, setCounter: { id: 'absent', value: 0 } },
    ];
    return 'mechanics.tileRules[0].setCounter.id';
  },
  (p) => {
    mechanics(p).extraDistance = { 'bad.position': 1 };
    return 'mechanics.extraDistance["bad.position"]';
  },
  (p) => {
    const key = String(tiles(p).length);
    mechanics(p).extraDistance = { [key]: 1 };
    return 'mechanics.extraDistance.' + key;
  },
  (p) => {
    mechanics(p).ranking = [['absent']];
    return 'mechanics.ranking[0][0]';
  },
];
const cases: Case[] = [
  ...resourceCases.map((change) => ({ key: 'resourceTrackRace', change })),
  {
    key: 'gooseRace',
    change: (p) => {
      tiles(p)[1].type = 'absent';
      return 'tiles[1].type';
    },
  },
  {
    key: 'gooseRace',
    change: (p) => {
      tiles(p)[1].backTo = tiles(p).length;
      return 'tiles[1].backTo';
    },
  },
  {
    key: 'gooseRace',
    change: (p) => {
      object(p.pawnSelection).setId = 'absent';
      return 'pawnSelection.setId';
    },
  },
  {
    key: 'bidirectionalCollisionRace',
    change: (p) => {
      tiles(p)[1].n = 999;
      return 'tiles[1].n';
    },
  },
  {
    key: 'bidirectionalCollisionRace',
    change: (p) => {
      tiles(p)[0].type = 'neutral';
      return 'tiles[0].type';
    },
  },
  {
    key: 'bidirectionalCollisionRace',
    change: (p) => {
      const index = tiles(p).length - 1;
      tiles(p)[index].type = 'neutral';
      return `tiles[${index}].type`;
    },
  },
];

it.each(cases)(
  'locates invalid race configuration for $key',
  ({ key, change }) => {
    const { source, program, manifest } = fixture(key);
    const path = 'extensions[0].config.' + change(program);
    try {
      compileJsonGame(manifest, source);
      throw new Error('Expected authoring error');
    } catch (error) {
      expect(error).toBeInstanceOf(AuthoringError);
      expect(error).toMatchObject({
        code: 'GAME_AUTHORING_ERROR',
        path: 'game.json.' + path,
        received: authoringValueAt(source, path),
      });
    }
  },
);

it.each([
  'resourceTrackRace',
  'gooseRace',
  'bidirectionalCollisionRace',
  'pairedPawnRace',
  'teamPawnRace',
])('accepts unchanged %s', (key) => {
  const { source, manifest } = fixture(key);
  expect(() => compileJsonGame(manifest, source)).not.toThrow();
});
