import { GameConfigurationError } from '../../core/domain/errors/game-domain.errors';
import type { PawScoringProgram } from '../effect-packs/choice-simultaneous-paw-scoring/program';
import { effectJsonSchema } from '../../engine/runtime/contracts/effect-json-schema';
import {
  type AuthorSchema,
  authorArray as array,
  authorId as id,
  authorObject as object,
} from '../../engine/runtime/contracts/json-author-schema';

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
  const fail = (reason: string): never => {
    throw new GameConfigurationError('paw-scoring card: ' + reason);
  };
  const rules = program.mechanics;
  const unique = (values: readonly (string | number)[], label: string) => {
    if (new Set(values).size !== values.length) fail(label + ' must be unique');
  };
  const reference = (values: readonly string[], value: string) => {
    if (!values.includes(value)) fail('unknown mechanic reference: ' + value);
  };
  const obstacles = rules.obstacles.map((rule) => rule.id);
  const powers = rules.powers.map((rule) => rule.id);
  unique(obstacles, 'obstacles');
  unique(powers, 'powers');
  unique(rules.counters, 'counters');
  unique(Object.values(rules.statuses), 'statuses');
  unique(
    rules.moveLimits.map((limit) => limit.value),
    'limited move values',
  );
  unique(
    rules.moveLimits.map((limit) => limit.resource),
    'limit resources',
  );
  if (
    Object.entries(rules.statuses).some(
      ([key, value]) =>
        key !== 'power' && value.startsWith(rules.statuses.power),
    )
  )
    fail('power status prefix collides with another status');
  reference(rules.counters, rules.activationCounter);
  for (const rule of rules.obstacles) reference(rules.counters, rule.counter);
  for (const rule of rules.powers) {
    for (const obstacle of rule.ignores) reference(obstacles, obstacle);
    for (const counter of rule.disablesCounters)
      reference(rules.counters, counter);
  }
  if (
    new Set(program.cards.map((card) => card.id)).size !== program.cards.length
  )
    fail('card identifiers must be unique');
  if (program.initialHandSize * 2 > program.cards.length)
    fail('deck cannot deal the minimum player hands');
  for (const card of program.cards) {
    if (card.type === 'obstacle') reference(obstacles, card.obstacle);
    if (card.type === 'parade') reference(rules.counters, card.parade);
    if (card.type === 'bot') reference(powers, card.bot);
    if (card.type === 'pattes' && card.value > program.goal)
      fail('card ' + card.id + ' exceeds the goal');
  }
}
