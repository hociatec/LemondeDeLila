import type { EffectCondition } from '../contracts/effect-ir';
import type { VictoryRule } from '../contracts/author-rule-contracts';
import { assertConditionJson } from '../contracts/effect-json-schema';
import { validateLocalCondition } from '../effects/game-effect-reference-validator';
import { evaluateEffectCondition } from '../effects/effect-condition-evaluator';
import { AuthoringError } from '../contracts/authoring-error';

export type ConditionVictory = {
  kind: 'condition';
  condition: EffectCondition;
  participants?: 'active' | 'all';
  ties?: 'all' | 'lowest-id';
  reason?: string;
};

/** Each participant is evaluated against the same bounded, read-only predicate. */
export function conditionVictory<TState extends object>(
  definition: ConditionVictory,
): VictoryRule<TState> {
  assertConditionJson(definition.condition);
  validateLocalCondition(
    definition.condition,
    'victory.condition',
    (path, reason) => {
      throw new AuthoringError(path, reason, definition.condition);
    },
  );
  const rule = structuredClone(definition);
  return {
    evaluate: ({ ctx }) => {
      const players =
        rule.participants === 'all' ? ctx.players.all() : ctx.players.active();
      const winners = players
        .filter(
          (player) =>
            evaluateEffectCondition(rule.condition, () => [player.id], ctx) ===
            true,
        )
        .map((player) => player.id)
        .sort((a, b) => a - b);
      if (!winners.length) return null;
      return {
        winnerPlayerIds:
          rule.ties === 'lowest-id' ? winners.slice(0, 1) : winners,
        reason: rule.reason ?? 'condition',
      };
    },
  };
}
