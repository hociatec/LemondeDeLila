import type { GameActionMap } from '../contracts/author-rule-contracts';
import type { GameBotDefinition } from './game-definition-contracts';
import type { JsonGameDocument } from './json-game-schema';

export type JsonProgramBot = GameBotDefinition<
  Record<string, never>,
  GameActionMap<Record<string, never>>
>;

export function recipeBot(
  document: JsonGameDocument,
  recipe: string,
): JsonProgramBot {
  return {
    choose: ({ availableActions }) => {
      const type = availableActions.find((id) => {
        const action = document.actions[id];
        return action && 'recipe' in action && action.recipe === recipe;
      });
      return type ? { type, payload: {} } : null;
    },
  };
}

export function boardBot(document: JsonGameDocument): JsonProgramBot {
  return {
    choose: ({ availableActions }) => {
      const type =
        availableActions.find((id) => {
          const action = document.actions[id];
          return action && 'recipe' in action && action.recipe === 'board-draw';
        }) ?? availableActions[0];
      return type ? { type, payload: {} } : null;
    },
  };
}
