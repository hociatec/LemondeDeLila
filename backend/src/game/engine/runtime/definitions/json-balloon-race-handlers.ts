import type { GameBotDefinition } from './game-definition-contracts';
import type { GameActionMap } from '../contracts/author-rule-contracts';
import type { JsonGameDocument } from './json-game-schema';
import { publicField } from '../kits/visibility-kit';
import type { balloonRaceRules } from '../recipes/gameplay/balloon-race.recipes';

type State = Record<string, never>;
type Program = ReturnType<typeof balloonRaceRules>;

export function balloonRaceHandlers(
  document: JsonGameDocument,
  program: Program,
) {
  const bot: GameBotDefinition<State, GameActionMap<State>> = {
    choose: ({ availableActions }) => {
      const type =
        actionType(document, availableActions, 'balloon-race-draw') ??
        actionType(document, availableActions, 'balloon-race-roll');
      return type ? { type, payload: {} } : null;
    },
  };
  return {
    setup: program.setup,
    choices: program.choices,
    effects: program.effects,
    playerValuesVisibility: { statuses: publicField() },
    bot,
  };
}

function actionType(
  document: JsonGameDocument,
  availableActions: readonly string[],
  recipe: 'balloon-race-draw' | 'balloon-race-roll',
) {
  return availableActions.find((id) => {
    const action = document.actions[id];
    return action && 'recipe' in action && action.recipe === recipe;
  });
}
