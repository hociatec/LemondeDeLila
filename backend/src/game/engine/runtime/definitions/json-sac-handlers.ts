import type { GameActionMap } from '../contracts/author-rule-contracts';
import type { GameBotDefinition } from './game-definition-contracts';
import type { JsonGameDocument } from './json-game-schema';
import type { sacRules } from '../recipes/gameplay/sac.recipes';

type State = Record<string, never>;
type Program = ReturnType<typeof sacRules>;

export function sacHandlers(document: JsonGameDocument, program: Program) {
  const actionFor = (
    recipes: readonly string[],
    availableActions: readonly string[],
  ) =>
    availableActions.find((id) => {
      const action = document.actions[id];
      return action && 'recipe' in action && recipes.includes(action.recipe);
    });
  const bot: GameBotDefinition<State, GameActionMap<State>> = {
    choose: ({ availableActions }) => {
      const type = actionFor(
        ['sac-use-jail-card', 'sac-pay-fine', 'sac-roll'],
        availableActions,
      );
      return type ? { type, payload: {} } : null;
    },
  };
  return {
    choices: program.choices,
    effects: program.effects,
    config: program.config,
    setup: program.setup,
    initialization: program.initialization,
    resourceIds: program.resourceIds,
    viewExtension: program.viewExtension,
    bot,
  };
}
