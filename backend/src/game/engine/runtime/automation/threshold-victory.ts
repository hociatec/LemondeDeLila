import type { GameContext } from '../definitions/game-author-context';
import type { VictoryRule } from '../contracts/author-rule-contracts';
import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';

export type ThresholdVictory = (
  | { kind: 'score-at-least'; amount: number }
  | { kind: 'resource-at-least'; resource: string; amount: number }
) & {
  participants?: 'active' | 'all';
  selection?: 'all-qualified' | 'unique-qualified' | 'highest-value-lowest-id';
  reason?: string;
};

/** A standard threshold with an explicit policy for simultaneous qualifiers. */
export function thresholdVictory<TState extends object>(
  condition: ThresholdVictory,
): VictoryRule<TState> {
  if (
    !Number.isFinite(condition.amount) ||
    condition.amount <= 0 ||
    (condition.kind === 'resource-at-least' && !condition.resource.trim())
  )
    throw new GameConfigurationError('Invalid victory threshold');
  const rule = Object.freeze({ ...condition });
  return Object.freeze({
    evaluate: ({ ctx }: { state: TState; ctx: GameContext<TState> }) =>
      evaluate(ctx, rule),
  });
}

function evaluate<TState extends object>(
  ctx: GameContext<TState>,
  condition: ThresholdVictory,
) {
  const players =
    condition.participants === 'all' ? ctx.players.all() : ctx.players.active();
  const qualified = players
    .map((player) => ({
      id: player.id,
      value:
        condition.kind === 'score-at-least'
          ? ctx.score.get(player.id)
          : ctx.resources.get(player.id, condition.resource),
    }))
    .filter((player) => player.value >= condition.amount);
  if (
    !qualified.length ||
    (condition.selection === 'unique-qualified' && qualified.length !== 1)
  )
    return null;
  const winnerPlayerIds =
    condition.selection === 'highest-value-lowest-id'
      ? [qualified.sort((a, b) => b.value - a.value || a.id - b.id)[0].id]
      : qualified.map((player) => player.id);
  return { winnerPlayerIds, reason: condition.reason ?? condition.kind };
}
