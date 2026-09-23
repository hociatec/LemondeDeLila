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
function rows(value: unknown) {
  return list(value).map(object);
}
type Case = { key: string; change: (p: Data) => string };
const cases: Case[] = [];
function paw(change: Case['change']) {
  cases.push({ key: 'pawScoring', change });
}
function chapter(change: Case['change']) {
  cases.push({ key: 'chapterEncounter', change });
}
for (const [field, member] of [
  ['obstacles', 'id'],
  ['powers', 'id'],
  ['moveLimits', 'value'],
  ['moveLimits', 'resource'],
])
  paw((p) => {
    const entries = rows(object(p.mechanics)[field]);
    if (entries.length === 1) {
      object(p.mechanics)[field] = [
        entries[0],
        {
          ...entries[0],
          value: Number(entries[0].value) + 1,
          resource: 'distinct',
        },
      ];
      entries.push(object(list(object(p.mechanics)[field])[1]));
    }
    entries[1][member] = entries[0][member];
    return `mechanics.${field}[1].${member}`;
  });
paw((p) => {
  const rules = object(p.mechanics);
  const entries = list(rules.counters);
  rules.counters = [...entries, entries[0]];
  return `mechanics.counters[${entries.length}]`;
});
paw((p) => {
  const statuses = object(object(p.mechanics).statuses);
  const keys = Object.keys(statuses);
  statuses[keys[1]] = statuses[keys[0]];
  return `mechanics.statuses.${keys[1]}`;
});
paw((p) => {
  const statuses = object(object(p.mechanics).statuses);
  const key = Object.keys(statuses).find((key) => key !== 'power');
  if (!key) throw new Error('No status');
  statuses[key] = String(statuses.power) + 'suffix';
  return `mechanics.statuses.${key}`;
});
paw((p) => {
  object(p.mechanics).activationCounter = 'absent';
  return 'mechanics.activationCounter';
});
paw((p) => {
  rows(object(p.mechanics).obstacles)[0].counter = 'absent';
  return 'mechanics.obstacles[0].counter';
});
for (const field of ['ignores', 'disablesCounters'])
  paw((p) => {
    rows(object(p.mechanics).powers)[0][field] = ['absent'];
    return `mechanics.powers[0].${field}[0]`;
  });
for (const [type, field] of [
  ['obstacle', 'obstacle'],
  ['parade', 'parade'],
  ['bot', 'bot'],
  ['pattes', 'value'],
])
  paw((p) => {
    const cards = rows(p.cards);
    const i = cards.findIndex((card) => card.type === type);
    if (i < 0) throw new Error('Missing ' + type);
    cards[i][field] = field === 'value' ? Number(p.goal) + 1 : 'absent';
    return `cards[${i}].${field}`;
  });
paw((p) => {
  const cards = list(p.cards);
  p.cards = [...cards, cards[0]];
  return `cards[${cards.length}].id`;
});
chapter((p) => {
  const kinds = list(p.collectionKinds);
  p.collectionKinds = [...kinds, kinds[0]];
  return `collectionKinds[${kinds.length}]`;
});
chapter((p) => {
  list(p.collectionKinds)[0] = 'neutral';
  return 'collectionKinds[0]';
});
chapter((p) => {
  object(p.decks)['absent.deck'] = [rows(Object.values(object(p.decks))[0])[0]];
  return 'decks["absent.deck"]';
});
chapter((p) => {
  rows(p.tiles)[1].type = 'absent';
  return 'tiles[1].type';
});
chapter((p) => {
  const key = String(list(p.collectionKinds)[0]);
  delete object(p.decks)[key];
  return authoringProperty('decks', key);
});
chapter((p) => {
  const [key, value] = Object.entries(object(p.decks))[0];
  const cards = list(value);
  object(p.decks)[key] = [...cards, cards[0]];
  return `${authoringProperty('decks', key)}[${cards.length}].id`;
});
chapter((p) => {
  const [key, value] = Object.entries(object(p.decks))[0];
  rows(value)[0].collectionGain = 'absent';
  return `${authoringProperty('decks', key)}[0].collectionGain`;
});
for (const duplicate of [true, false])
  chapter((p) => {
    const firstDeck = rows(Object.values(object(p.decks))[0]);
    firstDeck[0].quiz = {
      choices: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      answerId: 'a',
      successDelta: 1,
    };
    for (const [key, value] of Object.entries(object(p.decks))) {
      const cards = rows(value);
      const i = cards.findIndex((card) => card.quiz);
      if (i < 0) continue;
      const quiz = object(cards[i].quiz);
      if (!duplicate) {
        quiz.answerId = 'absent';
        return `${authoringProperty('decks', key)}[${i}].quiz.answerId`;
      }
      const choices = rows(quiz.choices);
      quiz.choices = [...choices, choices[0]];
      return `${authoringProperty('decks', key)}[${i}].quiz.choices[${choices.length}].id`;
    }
    throw new Error('No quiz');
  });

it.each(cases)('locates $key reference errors', ({ key, change }) => {
  const { source, program, manifest } = fixture(key);
  const path = 'extensions[0].config.' + change(program);
  try {
    compileJsonGame(manifest, source);
    throw new Error('Expected authoring error');
  } catch (error) {
    expect(error).toBeInstanceOf(AuthoringError);
    expect(error).toMatchObject({
      path: 'game.json.' + path,
      received: authoringValueAt(source, path),
    });
  }
});
it.each(['pawScoring', 'chapterEncounter'])('accepts valid %s', (key) => {
  const { source, manifest } = fixture(key);
  expect(() => compileJsonGame(manifest, source)).not.toThrow();
});
