import { compileJsonGame } from '../../../rules/public-api';
import {
  AuthoringError,
  authoringValueAt,
} from '../../../engine/runtime/contracts/authoring-error';

import { fixture, object, type Data } from './extension-diagnostic-fixture';

function cards(program: Data): Data[] {
  if (!Array.isArray(program.cards)) throw new Error('Expected cards');
  return program.cards.map(object);
}
type Case = { key: string; change: (p: Data) => string };
const cases: Case[] = [
  ...['parade', 'ritualPhases', 'familyRequest', 'familyEffects'].map(
    (key) => ({
      key,
      change: (p: Data) => {
        const list = cards(p);
        p.cards = [...list, { ...list[0] }];
        return `cards[${list.length}].id`;
      },
    }),
  ),
  {
    key: 'parade',
    change: (p) => {
      const list = cards(p);
      list[1].value = list[0].value;
      return 'cards[1].value';
    },
  },
  {
    key: 'parade',
    change: (p) => {
      p.sequence = ['absent'];
      return 'sequence[0]';
    },
  },
  {
    key: 'parade',
    change: (p) => {
      p.sequence = [cards(p)[0].value, cards(p)[0].value];
      return 'sequence[1]';
    },
  },
  {
    key: 'parade',
    change: (p) => {
      object(p.rewards)['unknown.value'] = {};
      return 'rewards["unknown.value"]';
    },
  },
  {
    key: 'parade',
    change: (p) => {
      const value = String(cards(p)[0].value);
      object(p.rewards)[value] = { 'missing.resource': 1 };
      return `rewards.${value}["missing.resource"]`;
    },
  },
  {
    key: 'parade',
    change: (p) => {
      object(p.resourceValues)['missing.resource'] = 1;
      return 'resourceValues["missing.resource"]';
    },
  },
  {
    key: 'ritualPhases',
    change: (p) => {
      const list = cards(p);
      const first = list.find((c) => c.type === 'family');
      if (!first) throw new Error('No family');
      p.cards = [
        ...list,
        { ...first, id: 'new-card', familyName: 'Inconsistent' },
      ];
      return `cards[${list.length}].familyName`;
    },
  },
  {
    key: 'ritualPhases',
    change: (p) => {
      const list = cards(p);
      const i = list.findIndex((c) => c.type === 'special');
      list[i].effects = [];
      return `cards[${i}].effects`;
    },
  },
  {
    key: 'familyRequest',
    change: (p) => {
      const list = cards(p);
      const i = list.findIndex((c) => c.type === 'quiz');
      list[i].answerIndex = 99;
      return `cards[${i}].answerIndex`;
    },
  },
  {
    key: 'familyEffects',
    change: (p) => {
      const list = cards(p);
      const i = list.findIndex((c) => c.type === 'metier');
      delete list[i].family;
      return `cards[${i}].family`;
    },
  },
  {
    key: 'familyEffects',
    change: (p) => {
      const list = cards(p);
      const i = list.findIndex((c) => c.type === 'metier');
      list[i].family = 'absent';
      return `cards[${i}].family`;
    },
  },
  {
    key: 'familyEffects',
    change: (p) => {
      const list = cards(p);
      const i = list.findIndex((c) => c.type === 'special');
      list[i].family = 'absent';
      return `cards[${i}].family`;
    },
  },
  {
    key: 'familyEffects',
    change: (p) => {
      const ids = p.familyIds;
      if (!Array.isArray(ids)) throw new Error('No families');
      p.familyIds = [...ids, ids[0]];
      return `familyIds[${ids.length}]`;
    },
  },
];

it.each(cases)('locates invalid $key authoring %#', ({ key, change }) => {
  const { source, program, manifest } = fixture(key);
  const field = change(program);
  const path = `extensions[0].config.${field}`;
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

it.each(['parade', 'ritualPhases', 'familyRequest', 'familyEffects'])(
  'still compiles valid %s',
  (key) => {
    const { source, manifest } = fixture(key);
    expect(() => compileJsonGame(manifest, source)).not.toThrow();
  },
);
