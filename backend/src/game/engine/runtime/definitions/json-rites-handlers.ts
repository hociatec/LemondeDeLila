import type { GameActionMap } from '../contracts/author-rule-contracts';
import type { GameBotDefinition } from './game-definition-contracts';
import type { JsonGameDocument } from './json-game-schema';
import type { ritesRules } from '../recipes/gameplay/rites.recipes';

type State = Record<string, never>;
type Program = ReturnType<typeof ritesRules>;

export function ritesHandlers(document: JsonGameDocument, program: Program) {
  const bot: GameBotDefinition<State, GameActionMap<State>> = {
    choose: ({ actor, availableActions, ctx }) => {
      const selected = program.chooseBot(actor.id, ctx);
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
    choices: program.choices,
    lifecycle: program.lifecycle,
    effects: program.effects,
    bot,
  };
}
