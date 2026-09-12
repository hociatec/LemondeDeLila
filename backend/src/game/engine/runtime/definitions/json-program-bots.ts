import type { GameActionMap } from '../contracts/author-rule-contracts';
import type { GameBotDefinition } from './game-definition-contracts';
import type { JsonGameDocument } from './json-game-schema';

export type JsonProgramBot = GameBotDefinition<
  Record<string, never>,
  GameActionMap<Record<string, never>>
>;

type RollRecipe =
  | 'event-race-roll'
  | 'delivery-race-roll'
  | 'goose-race-roll'
  | 'collection-race-roll'
  | 'ecosystem-race-roll'
  | 'pirate-race-roll'
  | 'maman-race-roll'
  | 'frousse-race-roll'
  | 'galopons-race-roll'
  | 'foulees-race-roll'
  | 'galaxy-race-roll'
  | 'midnight-race-roll'
  | 'derape-race-roll'
  | 'zig-et-zag-draw'
  | 'pawn-race-roll';

export function recipeBot(
  document: JsonGameDocument,
  recipe: RollRecipe,
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
