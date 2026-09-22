import type { GameActionMap } from '../contracts/author-rule-contracts';
import type { GameBotDefinition } from './game-definition-contracts';
import type { JsonGameDocument } from './json-game-schema';
import type { JsonRecipeBotSelector } from '../contracts/json-effect-pack';

export type JsonProgramBot = GameBotDefinition<
  Record<string, never>,
  GameActionMap<Record<string, never>>
>;

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
