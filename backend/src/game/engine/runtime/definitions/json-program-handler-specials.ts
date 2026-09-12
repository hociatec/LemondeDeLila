import type { JsonGameDocument } from './json-game-schema';
import type { CompiledJsonPrograms } from './json-game-program-compiler';
import { recipeBot, type JsonProgramBot } from './json-program-bots';
import * as special from './json-special-program-handlers';

export function specialProgramHandlers(
  document: JsonGameDocument,
  programs: CompiledJsonPrograms,
) {
  const {
    derapeRace,
    balloonRace,
    voyage,
    catPattes,
    gerard,
    rites,
    sac,
    nawak,
    olympia,
  } = programs;
  if (derapeRace)
    return {
      choices: derapeRace.choices,
      effects: derapeRace.effects,
      bot: recipeBot(document, 'derape-race-roll'),
    };
  if (balloonRace) return special.balloonRaceHandlers(document, balloonRace);
  if (voyage) return special.voyageHandlers(document, voyage);
  if (catPattes) return special.catPattesHandlers(document, catPattes);
  if (gerard) return special.gerardHandlers(document, gerard);
  if (rites) return special.ritesHandlers(document, rites);
  if (sac) return special.sacHandlers(document, sac);
  if (nawak) {
    const bot: JsonProgramBot = {
      choose: ({ actor, availableActions, ctx }) => {
        const selected = nawak.chooseBot(actor.id, ctx);
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
      setup: nawak.setup,
      viewExtension: nawak.viewExtension,
      bot,
    };
  }
  if (!olympia) return undefined;
  const bot: JsonProgramBot = {
    choose: ({ actor, availableActions, ctx }) => {
      const cardId = olympia.firstCard(actor.id, ctx);
      const recipe = cardId ? 'olympia-play' : 'olympia-pass';
      const type = availableActions.find((id) => {
        const action = document.actions[id];
        return action && 'recipe' in action && action.recipe === recipe;
      });
      return type ? { type, payload: cardId ? { cardId } : {} } : null;
    },
  };
  return { effects: olympia.effects, bot };
}
