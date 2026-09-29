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
  {
    key: 'ritualPhases',
    change: (p: Data) => {
      const list = cards(p);
      p.cards = [...list, { ...list[0] }];
      return `cards[${list.length}].id`;
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

it.each(['ritualPhases'])('still compiles valid %s', (key) => {
  const { source, manifest } = fixture(key);
  expect(() => compileJsonGame(manifest, source)).not.toThrow();
});
