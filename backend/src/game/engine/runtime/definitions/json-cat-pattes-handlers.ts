import type { GameActionMap } from '../contracts/author-rule-contracts';
import type { GameBotDefinition } from './game-definition-contracts';
import type { JsonGameDocument } from './json-game-schema';
import type { catPattesRules } from '../recipes/gameplay/cat-pattes.recipes';

type State = Record<string, never>;
type Program = ReturnType<typeof catPattesRules>;

export function catPattesHandlers(
  document: JsonGameDocument,
  program: Program,
) {
  const bot: GameBotDefinition<State, GameActionMap<State>> = {
    choose: ({ actor, availableActions, ctx }) => {
      const selected = program.chooseBot(actor.id, ctx);
      if (!selected) return null;
      const type = availableActions.find((actionId) => {
        const action = document.actions[actionId];
        return (
          action && 'recipe' in action && action.recipe === selected.recipe
        );
      });
      return type ? { type, payload: selected.payload } : null;
    },
  };
  return {
    config: program.config,
    choices: {},
    lifecycle: program.lifecycle,
    effects: program.effects,
    playerValuesVisibility: program.playerValuesVisibility,
    bot,
  };
}
