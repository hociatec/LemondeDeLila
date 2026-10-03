import type { GameActionMap } from '../contracts/author-rule-contracts';
import type { GameBotDefinition } from './game-definition-contracts';
import type { JsonGameDocument } from './json-game-schema';
import type { JsonRecipeBotSelector } from '../contracts/json-engine-extension';
import type { JsonBotStrategy } from './json-game-core-document';

export type JsonProgramBot = GameBotDefinition<
  Record<string, never>,
  GameActionMap<Record<string, never>>
>;

/** Selects only server-validated legal actions and consumes the game RNG for every random choice. */
export function declarativeBot(strategy: JsonBotStrategy): JsonProgramBot {
  return {
    choose: ({ legalActions, ctx }) => {
      if (legalActions.length === 0) return null;
      let candidates = legalActions;
      if (strategy.kind === 'scored') {
        const score = (type: string) =>
          strategy.actionScores[type] ?? strategy.defaultScore ?? 0;
        const highest = Math.max(
          ...legalActions.map((action) => score(action.type)),
        );
        candidates = legalActions.filter(
          (action) => score(action.type) === highest,
        );
      }
      const selected =
        strategy.kind === 'random' ||
        (strategy.kind === 'scored' && strategy.ties === 'random')
          ? ctx.random.pick(candidates)
          : candidates[0];
      if (!selected) return null;
      return {
        type: selected.type,
        payload: structuredClone(selected.payload ?? {}),
      };
    },
  };
}

export function recipeBot(
  document: JsonGameDocument,
  recipe: string | readonly string[],
): JsonProgramBot {
  return {
    choose: ({ availableActions }) => {
      for (const candidate of typeof recipe === 'string' ? [recipe] : recipe) {
        const type = availableActions.find((id) => {
          const action = document.actions[id];
          return action && 'recipe' in action && action.recipe === candidate;
        });
        if (type) return { type, payload: {} };
      }
      return null;
    },
  };
}

export function fallbackRecipeBot(
  document: JsonGameDocument,
  preferred: string,
): JsonProgramBot {
  return {
    choose: ({ availableActions }) => {
      const type =
        availableActions.find((id) => {
          const action = document.actions[id];
          return action && 'recipe' in action && action.recipe === preferred;
        }) ?? availableActions[0];
      return type ? { type, payload: {} } : null;
    },
  };
}

/** Preserve the selector payload while resolving only an available action. */
export function selectedRecipeBot(
  document: JsonGameDocument,
  select: JsonRecipeBotSelector,
): JsonProgramBot {
  return {
    choose: (input) => {
      const selected = select(input);
      if (!selected) return null;
      const type = input.availableActions.find((id) => {
        const action = document.actions[id];
        return (
          action && 'recipe' in action && action.recipe === selected.recipe
        );
      });
      return type ? { type, payload: selected.payload } : null;
    },
  };
}
