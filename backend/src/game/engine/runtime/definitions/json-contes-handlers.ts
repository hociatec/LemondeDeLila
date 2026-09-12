import type { GameBotDefinition } from './game-definition-contracts';
import type { GameActionMap } from '../contracts/author-rule-contracts';
import type { JsonGameDocument } from './json-game-schema';
import type { contesRules } from '../recipes/gameplay/contes.recipes';

type State = Record<string, never>;
type Program = ReturnType<typeof contesRules>;

export function contesHandlers(document: JsonGameDocument, program: Program) {
  const bot: GameBotDefinition<State, GameActionMap<State>> = {
    choose: ({ availableActions }) => {
      const type = availableActions.find((id) => {
        const action = document.actions[id];
        return action && 'recipe' in action && action.recipe === 'contes-roll';
      });
      return type ? { type, payload: {} } : null;
    },
  };
  return {
    setup: program.setup,
    choices: program.choices,
    effects: program.effects,
    automatic: program.automatic,
    playerValuesVisibility: program.playerValuesVisibility,
    bot,
  };
}
