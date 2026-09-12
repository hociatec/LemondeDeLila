import type { GameActionMap } from '../contracts/author-rule-contracts';
import type { GameBotDefinition } from './game-definition-contracts';
import type { JsonGameDocument } from './json-game-schema';
import type { voyageRules } from '../recipes/gameplay/voyage.recipes';

type State = Record<string, never>;

export function voyageHandlers(
  document: JsonGameDocument,
  program: ReturnType<typeof voyageRules>,
) {
  const bot: GameBotDefinition<State, GameActionMap<State>> = {
    choose: ({ availableActions }) => {
      const type = availableActions.find((id) => {
        const action = document.actions[id];
        return action && 'recipe' in action && action.recipe === 'voyage-roll';
      });
      return type ? { type, payload: {} } : null;
    },
  };
  return {
    choices: program.choices,
    effects: program.effects,
    lifecycle: program.lifecycle,
    bot,
  };
}
