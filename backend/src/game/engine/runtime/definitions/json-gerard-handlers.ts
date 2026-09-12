import type { GameBotDefinition } from './game-definition-contracts';
import type { GameActionMap } from '../contracts/author-rule-contracts';
import type { JsonGameDocument } from './json-game-schema';
import type { gerardRules } from '../recipes/gameplay/gerard.recipes';

type State = Record<string, never>;
type Program = ReturnType<typeof gerardRules>;

export function gerardHandlers(document: JsonGameDocument, program: Program) {
  const bot: GameBotDefinition<State, GameActionMap<State>> = {
    choose: ({ actor, availableActions, ctx }) => {
      const selected = program.chooseBot(actor.id, ctx);
      if (!selected) return null;
      const type = availableActions.find((id) => {
        const action = document.actions[id];
        return (
          action && 'recipe' in action && action.recipe === selected.recipe
        );
      });
      return type ? { type, payload: selected.payload } : null;
    },
  };
  return {
    setup: program.setup,
    choices: {},
    effects: program.effects,
    viewExtension: program.viewExtension,
    bot,
  };
}
