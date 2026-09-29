import { compileJsonGame } from '../../../rules/public-api';
import {
  AuthoringError,
  authoringValueAt,
} from '../../../engine/runtime/contracts/authoring-error';
import { fixture, object, type Data } from './extension-diagnostic-fixture';

function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Expected array');
  return value;
}
function rows(value: unknown) {
  return list(value).map(object);
}
type Case = { key: string; change: (p: Data) => string };
const cases: Case[] = [];
function add(key: string, change: Case['change']) {
  cases.push({ key, change });
}
function duplicate(key: string, field: string, member?: string) {
  add(key, (p) => {
    const entries = list(p[field]);
    p[field] = [...entries, structuredClone(entries[0])];
    return `${field}[${entries.length}]${member ? '.' + member : ''}`;
  });
}
for (const key of ['protectedHauntedRace', 'quizEventRace', 'chainedTileRace'])
  add(key, (p) => {
    const tiles = rows(p.tiles);
    const index = tiles.length - 1;
    tiles[index].type = tiles[0].type;
    return `tiles[${index}].type`;
  });
for (const key of ['chainedTileRace'])
  add(key, (p) => {
    rows(p.tiles)[1].type = 'absent';
    return 'tiles[1].type';
  });
for (const key of ['protectedHauntedRace', 'quizEventRace'])
  add(key, (p) => {
    rows(p.tiles)[1].n = 999;
    return 'tiles[1].n';
  });
add('protectedHauntedRace', (p) => {
  rows(p.protections)[0].category = 'absent';
  return 'protections[0].category';
});
duplicate('protectedHauntedRace', 'protections', 'status');
add('quizEventRace', (p) => {
  Object.assign(rows(p.tiles)[1], { type: 'goto', target: 9999 });
  return 'tiles[1].target';
});
add('teamPawnRace', (p) => {
  list(p.startPositions)[0] = p.trackLength;
  return 'startPositions[0]';
});
add('teamPawnRace', (p) => {
  p.safeTiles = [p.trackLength];
  return 'safeTiles[0]';
});
duplicate('teamPawnRace', 'startPositions');
duplicate('teamPawnRace', 'families', 'id');
add('teamPawnRace', (p) => {
  rows(p.families)[0].pawns = [];
  return 'families[0].pawns';
});
add('chainedTileRace', (p) => {
  object(p.tileRules)['bad.rule'] = {
    kind: 'move-to',
    position: 9999,
    description: 'invalid',
  };
  return 'tileRules["bad.rule"].position';
});
duplicate('chainedTileRace', 'cards', 'id');
duplicate('chainedTileRace', 'pawns', 'id');
for (const field of ['id', 'effectId'])
  add('themeNameCards', (p) => {
    const rules = rows(p.specialRules);
    rules[1][field] = rules[0][field];
    return `specialRules[1].${field}`;
  });
for (const field of ['names', 'themes', 'specialCards'])
  duplicate('themeNameCards', field, 'id');
add('themeNameCards', (p) => {
  rows(p.specialCards)[0].effects = [];
  return 'specialCards[0].effects';
});

it.each(cases)('locates the invalid member of $key', ({ key, change }) => {
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
});

it.each([...new Set(cases.map(({ key }) => key))])(
  'keeps valid %s accepted',
  (key) => {
    const { source, manifest } = fixture(key);
    expect(() => compileJsonGame(manifest, source)).not.toThrow();
  },
);
