import { assertUniqueAuthorIds } from '../../../engine/sdk/extension-api';
import {
  authoringFailure,
  assertUniqueAuthorValues,
} from '../../../engine/sdk/extension-api';
import type { PawScoringProgram } from './program';
import { effectJsonSchema } from '../../../engine/sdk/extension-api';
import {
  type AuthorSchema,
  authorArray as array,
  authorId as id,
  authorObject as object,
} from '../../../engine/sdk/extension-api';

const text: AuthorSchema = { type: 'string', minLength: 1, maxLength: 10000 };
const base = {
  id,
  name: text,
  description: text,
  effect: text,
  effects: effectJsonSchema,
};

export const jsonPawScoringSchema: AuthorSchema = object({
  deckId: id,
  handId: id,
  trackId: id,
  goal: { type: 'integer', minimum: 1, maximum: 1000000 },
  initialHandSize: { type: 'integer', minimum: 1, maximum: 100 },
  defaultRounds: { type: 'integer', minimum: 1, maximum: 20 },
  statusPrefix: id,
  mechanics: object({
    statuses: object({
      obstacle: id,
      power: id,
      activated: id,
      activationUsed: id,
      obstacleLock: id,
    }),
    activationCounter: id,
    counters: array(id, 1),
    obstacles: array(
      object(
        {
          id,
          counter: id,
          blocks: { type: 'boolean' },
          maximumMove: { type: 'integer', minimum: 0, maximum: 1000000 },
        },
        ['id', 'counter', 'blocks'],
      ),
    ),
    powers: array(
      object({
        id,
        ignores: array(id),
        disablesCounters: array(id),
        bypassesActivation: { type: 'boolean' },
      }),
    ),
    moveLimits: array(
      object({
        value: { type: 'integer', minimum: 1, maximum: 1000000 },
        uses: { type: 'integer', minimum: 1, maximum: 1000000 },
        resource: id,
      }),
    ),
    finishReason: id,
  }),
  cards: array(
    {
      oneOf: [
        object(
          {
            ...base,
            type: { const: 'pattes' },
            value: { type: 'integer', minimum: 1, maximum: 1000000 },
          },
          ['id', 'name', 'type', 'value', 'effects'],
        ),
        object(
          {
            ...base,
            type: { const: 'obstacle' },
            obstacle: id,
          },
          ['id', 'name', 'type', 'obstacle', 'effects'],
        ),
        object(
          {
            ...base,
            type: { const: 'parade' },
            parade: id,
          },
          ['id', 'name', 'type', 'parade', 'effects'],
        ),
        object(
          {
            ...base,
            type: { const: 'bot' },
            bot: id,
          },
          ['id', 'name', 'type', 'bot', 'effects'],
        ),
      ],
    },
    1,
  ),
});

export function assertPawScoringReferences(program: PawScoringProgram): void {
  const fail = authoringFailure(
    'game.json.pawScoring',
    program,
    'paw-scoring card: ',
  );
  const rules = program.mechanics;
  const unique = (
    values: readonly (string | number)[],
    path: string,
    member = '',
  ) =>
    assertUniqueAuthorValues(
      values,
      (i) => `mechanics.${path}[${i}]${member}`,
      fail,
    );
  const reference = (
    values: readonly string[],
    value: string,
    path: string,
  ) => {
    if (!values.includes(value))
      fail(path, 'unknown mechanic reference: ' + value);
  };
  const obstacles = rules.obstacles.map((rule) => rule.id);
  const powers = rules.powers.map((rule) => rule.id);
  unique(obstacles, 'obstacles', '.id');
  unique(powers, 'powers', '.id');
  unique(rules.counters, 'counters');
  assertUniqueAuthorValues(
    Object.values(rules.statuses),
    (i) => `mechanics.statuses.${Object.keys(rules.statuses)[i]}`,
    fail,
  );
  unique(
    rules.moveLimits.map((limit) => limit.value),
    'moveLimits',
    '.value',
  );
  unique(
    rules.moveLimits.map((limit) => limit.resource),
    'moveLimits',
    '.resource',
  );
  for (const [key, value] of Object.entries(rules.statuses))
    if (key !== 'power' && value.startsWith(rules.statuses.power))
      fail(
        `mechanics.statuses.${key}`,
        'power status prefix collides with another status',
      );
  reference(
    rules.counters,
    rules.activationCounter,
    'mechanics.activationCounter',
  );
  rules.obstacles.forEach((rule, i) =>
    reference(
      rules.counters,
      rule.counter,
      `mechanics.obstacles[${i}].counter`,
    ),
  );
  for (const [i, rule] of rules.powers.entries()) {
    rule.ignores.forEach((obstacle, j) =>
      reference(obstacles, obstacle, `mechanics.powers[${i}].ignores[${j}]`),
    );
    rule.disablesCounters.forEach((counter, j) =>
      reference(
        rules.counters,
        counter,
        `mechanics.powers[${i}].disablesCounters[${j}]`,
      ),
    );
  }
  assertUniqueAuthorIds(program.cards, 'cards', fail);
  if (program.initialHandSize * 2 > program.cards.length)
    fail('initialHandSize', 'deck cannot deal the minimum player hands');
  for (const [i, card] of program.cards.entries()) {
    if (card.type === 'obstacle')
      reference(obstacles, card.obstacle, `cards[${i}].obstacle`);
    if (card.type === 'parade')
      reference(rules.counters, card.parade, `cards[${i}].parade`);
    if (card.type === 'bot') reference(powers, card.bot, `cards[${i}].bot`);
    if (card.type === 'pattes' && card.value > program.goal)
      fail(`cards[${i}].value`, 'card ' + card.id + ' exceeds the goal');
  }
}
