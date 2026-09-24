import type { GameContext } from './game-author-context';
import type { GameComponentDefinition } from './component-kit';
import type { VictoryRule } from '../contracts/author-rule-contracts';
import {
  conditionVictory,
  type ConditionVictory,
} from '../automation/condition-victory';
import { validateEffectCondition } from '../effects/game-effect-reference-validator';
import { indexComponents } from './game-definition-component-validator';
import {
  thresholdVictory,
  type ThresholdVictory,
} from '../automation/threshold-victory';
import {
  authorObject as object,
  authorArray as array,
  authorId as id,
  authorPositive as positive,
  authorRef as ref,
} from '../contracts/json-author-schema';

type RankingMetric = (
  { kind: 'score' } | { kind: 'resource'; resource: string }
) & { direction: 'asc' | 'desc' };

export type JsonStandardVictory =
  | ConditionVictory
  | ThresholdVictory
  | ((
      | { kind: 'track-finish'; trackId: string; ties: 'all' | 'lowest-id' }
      | { kind: 'last-player' }
      | {
          kind: 'rounds-completed';
          amount: number;
          participants: 'active' | 'all';
          ranking: readonly RankingMetric[];
          ties: 'all' | 'lowest-id';
        }
    ) & { reason?: string });

const reason = { type: 'string', minLength: 1, maxLength: 128 } as const;
const ties = { enum: ['all', 'lowest-id'] } as const;
const direction = { enum: ['asc', 'desc'] } as const;
export const standardVictorySchemas = [
  object(
    {
      kind: { const: 'condition' },
      condition: ref('condition'),
      participants: { enum: ['active', 'all'] },
      ties,
      reason,
    },
    ['kind', 'condition'],
  ),
  object({ kind: { const: 'track-finish' }, trackId: id, ties, reason }, [
    'kind',
    'trackId',
    'ties',
  ]),
  object({ kind: { const: 'last-player' }, reason }, ['kind']),
  object(
    {
      kind: { const: 'rounds-completed' },
      amount: positive,
      participants: { enum: ['active', 'all'] },
      ties,
      reason,
      ranking: array(
        {
          oneOf: [
            object({ kind: { const: 'score' }, direction }),
            object({ kind: { const: 'resource' }, resource: id, direction }),
          ],
        },
        1,
      ),
    },
    ['kind', 'amount', 'participants', 'ranking', 'ties'],
  ),
];

export function standardVictory<TState extends object>(
  condition: JsonStandardVictory,
): VictoryRule<TState> {
  if (condition.kind === 'condition') return conditionVictory(condition);
  if (
    condition.kind === 'score-at-least' ||
    condition.kind === 'resource-at-least'
  )
    return thresholdVictory(condition);
  const rule = structuredClone(condition);
  return { evaluate: ({ ctx }) => evaluate(ctx, rule) };
}

function evaluate<TState extends object>(
  ctx: GameContext<TState>,
  rule: Exclude<JsonStandardVictory, ThresholdVictory | ConditionVictory>,
) {
  let ranking: number[][];
  if (rule.kind === 'last-player') {
    const active = ctx.players.active();
    if (active.length > 1) return null;
    ranking = [active.map((player) => player.id)];
  } else if (rule.kind === 'track-finish') {
    const winners = ctx.players
      .active()
      .filter((player) => ctx.movement.atFinish(rule.trackId, player.id))
      .map((player) => player.id)
      .sort((left, right) => left - right);
    if (!winners.length) return null;
    ranking = [winners];
  } else {
    if (ctx.round.completed() < rule.amount) return null;
    const players =
      rule.participants === 'all' ? ctx.players.all() : ctx.players.active();
    ranking = ctx.ranking.tiers(
      players.map((player) => player.id),
      ...rule.ranking.map((metric) => ({
        direction: metric.direction,
        value: (playerId: number) =>
          metric.kind === 'score'
            ? ctx.score.get(playerId)
            : ctx.resources.get(playerId, metric.resource),
      })),
    );
    if (!ranking.length) return null;
  }
  const winners = ranking[0];
  return {
    winnerPlayerIds:
      'ties' in rule && rule.ties === 'lowest-id' ? [winners[0]] : winners,
    reason: rule.reason ?? rule.kind,
    ...(rule.kind === 'rounds-completed' ? { ranking } : {}),
  };
}

export function assertStandardVictoryReferences(
  rule: { kind: string } | JsonStandardVictory,
  components: readonly GameComponentDefinition[],
  resources: ReadonlySet<string>,
  fail: (path: string, reason: string) => never,
  phases?: ReadonlySet<string>,
): void {
  if (rule.kind === 'condition' && 'condition' in rule) {
    const references = indexComponents(
      {
        id: 'victory-validation',
        players: { min: 1, max: 100 },
        actions: {},
        components,
        resourceIds: [...resources],
      },
      fail,
    );
    validateEffectCondition(
      rule.condition,
      'victory.condition',
      { ...references, phases },
      fail,
    );
  }
  if (
    rule.kind === 'track-finish' &&
    'trackId' in rule &&
    !components.some(
      (component) =>
        component.component === 'movement.track' &&
        component.id === rule.trackId,
    )
  )
    fail('victory.trackId', 'unknown track');
  if (rule.kind === 'rounds-completed' && 'ranking' in rule) {
    for (const metric of rule.ranking) {
      if (metric.kind === 'resource' && !resources.has(metric.resource))
        fail('victory.ranking.resource', `unknown resource ${metric.resource}`);
    }
  }
}
