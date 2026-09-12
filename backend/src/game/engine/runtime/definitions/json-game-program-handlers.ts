import type { JsonGameDocument as JsonDocument } from './json-game-schema';
import type { CompiledJsonPrograms as Programs } from './json-game-program-compiler';
import { publicField } from '../kits/visibility-kit';
import * as special from './json-special-program-handlers';
import {
  boardBot,
  recipeBot,
  type JsonProgramBot as Bot,
} from './json-program-bots';
import { specialProgramHandlers } from './json-program-handler-specials';

export function programHandlers(document: JsonDocument, programs: Programs) {
  return {
    choices: undefined,
    ...selectProgramHandlers(document, programs),
  };
}

function selectProgramHandlers(document: JsonDocument, programs: Programs) {
  const {
    board,
    grid,
    judged,
    eventRace,
    deliveryRace,
    gooseRace,
    collectionRace,
    ecosystemRace,
    pirateRace,
    parade,
    natureFamilies,
    carAssembly,
    wonderMarket,
    mamanRace,
    cardCircles,
    mineDomain,
    frousseRace,
    galoponsRace,
    professionFamilies,
    fouleesRace,
    galaxyRace,
    midnightRace,
    bananaTroops,
    mnemosyne,
    corridor,
    contes,
    lama,
    zigEtZag,
    pawnRace,
  } = programs;
  const initialHandlers = () => {
    if (pawnRace)
      return {
        choices: pawnRace.choices,
        bot: recipeBot(document, 'pawn-race-roll'),
      };
    if (eventRace) {
      const bot = recipeBot(document, 'event-race-roll');
      return {
        setup: eventRace.setup,
        choices: eventRace.choices,
        effects: eventRace.effects,
        bot,
      };
    }
    if (deliveryRace) return { bot: recipeBot(document, 'delivery-race-roll') };
    if (gooseRace)
      return {
        setup: gooseRace.setup,
        choices: gooseRace.choices,
        playerValuesVisibility: gooseRace.playerValuesVisibility,
        bot: recipeBot(document, 'goose-race-roll'),
      };
    if (collectionRace)
      return { bot: recipeBot(document, 'collection-race-roll') };
    if (ecosystemRace)
      return { bot: recipeBot(document, 'ecosystem-race-roll') };
    if (pirateRace)
      return {
        effects: pirateRace.effects,
        bot: recipeBot(document, 'pirate-race-roll'),
      };
    if (parade) {
      const bot: Bot = {
        choose: ({ actor, ctx, availableActions }) => {
          const cardId = parade.playable(actor.id, ctx)[0];
          const recipe = cardId ? 'parade-play' : 'parade-pass';
          const type = availableActions.find((id) => {
            const action = document.actions[id];
            return action && 'recipe' in action && action.recipe === recipe;
          });
          return type ? { type, payload: cardId ? { cardId } : {} } : null;
        },
      };
      return { victory: parade.victory, bot };
    }
    if (natureFamilies) {
      const bot: Bot = {
        choose: ({ actor, ctx, availableActions }) => {
          const target = ctx.players.others(actor.id)[0];
          const cardId =
            natureFamilies.familyIds[
              ctx.random.int(natureFamilies.familyIds.length)
            ];
          const recipe =
            target && cardId ? 'nature-families-ask' : 'nature-families-pass';
          const type = availableActions.find((id) => {
            const action = document.actions[id];
            return action && 'recipe' in action && action.recipe === recipe;
          });
          return type
            ? {
                type,
                payload:
                  target && cardId ? { targetPlayerId: target.id, cardId } : {},
              }
            : null;
        },
      };
      return { bot };
    }
    if (carAssembly) {
      const bot: Bot = {
        choose: ({ actor, ctx, availableActions }) => {
          const cardId = carAssembly.playable(actor.id, ctx)[0];
          const recipe = cardId ? 'car-assembly-play' : 'car-assembly-pass';
          const type = availableActions.find((id) => {
            const action = document.actions[id];
            return action && 'recipe' in action && action.recipe === recipe;
          });
          return type ? { type, payload: cardId ? { cardId } : {} } : null;
        },
      };
      return {
        automatic: carAssembly.automatic,
        viewExtension: carAssembly.viewExtension,
        bot,
      };
    }
  };
  const initial = initialHandlers();
  if (initial) return initial;
  const collectionHandlers = () => {
    if (wonderMarket) {
      const bot: Bot = {
        choose: ({ actor, ctx, availableActions }) => {
          const selected = wonderMarket.choose(actor.id, ctx);
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
        playerValuesVisibility: { statuses: publicField() },
        bot,
      };
    }
    if (mamanRace)
      return {
        effects: mamanRace.effects,
        bot: recipeBot(document, 'maman-race-roll'),
      };
    if (cardCircles) {
      const program = document.cardCircles;
      if (!program) return {};
      const actionUsesRecipe = (id: string, recipe: string): boolean => {
        const action = document.actions[id];
        return Boolean(
          action && 'recipe' in action && action.recipe === recipe,
        );
      };
      const bot: Bot = {
        choose: ({ actor, ctx, availableActions }) => {
          const circle = cardCircles.circles(
            ctx.cards.hand<string>(program.handId, actor.id),
          )[0];
          const hand = ctx.cards.hand<string>(program.handId, actor.id);
          const recipe =
            circle &&
            availableActions.some((id) =>
              actionUsesRecipe(id, 'card-circles-form'),
            )
              ? 'card-circles-form'
              : hand.length > program.handLimit
                ? 'card-circles-discard'
                : 'card-circles-pass';
          const type = availableActions.find((id) =>
            actionUsesRecipe(id, recipe),
          );
          return type
            ? {
                type,
                payload:
                  recipe === 'card-circles-form'
                    ? { cardIds: circle }
                    : recipe === 'card-circles-discard'
                      ? { cardId: hand[0] }
                      : {},
              }
            : null;
        },
      };
      return { lifecycle: cardCircles.lifecycle, bot };
    }
    if (mineDomain && document.mineDomain) {
      const actionType = (
        recipe: string,
        availableActions: readonly string[],
      ) =>
        availableActions.find((id) => {
          const action = document.actions[id];
          return action && 'recipe' in action && action.recipe === recipe;
        });
      const bot: Bot = {
        choose: ({ actor, ctx, availableActions }) => {
          const play = mineDomain.enumerate(actor.id, ctx)[0];
          const recipe = play ? 'mine-domain-play' : 'mine-domain-pass';
          const type = actionType(recipe, availableActions);
          return type ? { type, payload: play ?? {} } : null;
        },
      };
      return {
        effects: mineDomain.effects,
        lifecycle: mineDomain.lifecycle,
        bot,
      };
    }
  };
  const collection = collectionHandlers();
  if (collection) return collection;
  const raceHandlers = () => {
    if (frousseRace)
      return {
        setup: frousseRace.setup,
        choices: frousseRace.choices,
        effects: frousseRace.effects,
        playerValuesVisibility: { statuses: publicField() },
        bot: recipeBot(document, 'frousse-race-roll'),
      };
    if (galoponsRace)
      return {
        setup: galoponsRace.setup,
        choices: galoponsRace.choices,
        effects: galoponsRace.effects,
        bot: recipeBot(document, 'galopons-race-roll'),
      };
    if (professionFamilies) {
      const bot: Bot = {
        choose: ({ actor, ctx, availableActions }) => {
          const type = availableActions.find((id) => {
            const action = document.actions[id];
            return (
              action &&
              'recipe' in action &&
              action.recipe === 'profession-families-request'
            );
          });
          const payload = professionFamilies.enumerate(actor.id, ctx)[0];
          return type && payload ? { type, payload } : null;
        },
      };
      return { effects: professionFamilies.effects, bot };
    }
    if (fouleesRace)
      return {
        setup: fouleesRace.setup,
        choices: fouleesRace.choices,
        bot: recipeBot(document, 'foulees-race-roll'),
      };
    if (galaxyRace)
      return {
        choices: galaxyRace.choices,
        effects: galaxyRace.effects,
        bot: recipeBot(document, 'galaxy-race-roll'),
      };
    if (midnightRace)
      return {
        setup: midnightRace.setup,
        choices: midnightRace.choices,
        effects: midnightRace.effects,
        playerValuesVisibility: { statuses: publicField() },
        bot: recipeBot(document, 'midnight-race-roll'),
      };
    if (bananaTroops) {
      const bot: Bot = {
        choose: ({ actor, ctx, availableActions }) => {
          const play = bananaTroops.enumerate(actor.id, ctx)[0];
          const recipe = play ? 'banana-troops-play' : 'banana-troops-pass';
          const type = availableActions.find((id) => {
            const action = document.actions[id];
            return action && 'recipe' in action && action.recipe === recipe;
          });
          return type ? { type, payload: play ?? {} } : null;
        },
      };
      return {
        effects: bananaTroops.effects,
        lifecycle: bananaTroops.lifecycle,
        bot,
      };
    }
  };
  const race = raceHandlers();
  if (race) return race;
  const specialized = specialProgramHandlers(document, programs);
  if (specialized) return specialized;
  const finalHandlers = () => {
    if (zigEtZag)
      return {
        setup: zigEtZag.setup,
        viewExtension: zigEtZag.viewExtension,
        bot: recipeBot(document, 'zig-et-zag-draw'),
      };
    if (mnemosyne) {
      const bot: Bot = {
        choose: ({ availableActions, ctx }) => {
          const selected = mnemosyne.chooseBot(availableActions, ctx);
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
      return { config: mnemosyne.config, bot };
    }
    if (corridor) {
      const bot: Bot = {
        choose: ({ actor, availableActions, ctx }) => {
          const type = availableActions.find((id) => {
            const action = document.actions[id];
            return (
              action && 'recipe' in action && action.recipe === 'corridor-move'
            );
          });
          const move = corridor.firstMove(actor.id, ctx);
          return type && move ? { type, payload: move } : null;
        },
      };
      return {
        config: corridor.config,
        choices: corridor.choices,
        initialization: corridor.initialization,
        bot,
      };
    }
    if (contes) return special.contesHandlers(document, contes);
    if (lama) {
      const bot: Bot = {
        choose: ({ actor, availableActions, ctx }) => {
          const selected = lama.chooseBot(actor.id, availableActions, ctx);
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
        config: lama.config,
        choices: lama.choices,
        initialization: lama.initialization,
        lifecycle: lama.lifecycle,
        automatic: lama.automatic,
        bot,
      };
    }
    if (judged && document.judgedCards) {
      const program = document.judgedCards;
      const bot: Bot = {
        choose: ({ actor, ctx, availableActions }) => {
          const judging = ctx.phase.current() === program.judgingPhase;
          const recipe = judging ? 'judged-pick' : 'judged-submit-card';
          const type = availableActions.find((id) => {
            const action = document.actions[id];
            return action && 'recipe' in action && action.recipe === recipe;
          });
          if (!type) return null;
          if (judging) {
            const winnerId = judged.chooseWinner(ctx);
            return winnerId == null ? null : { type, payload: { winnerId } };
          }
          const cardId = judged.chooseCard(ctx, actor.id);
          return cardId == null ? null : { type, payload: { cardId } };
        },
      };
      return { setup: judged.setup, bot };
    }
    if (grid) {
      const bot: Bot = {
        choose: ({ actor, ctx, availableActions }) => {
          const type = availableActions.find((id) => {
            const action = document.actions[id];
            return (
              action && 'recipe' in action && action.recipe === 'grid-place'
            );
          });
          const payload = type ? grid.choose(ctx, actor.id) : null;
          return type && payload ? { type, payload } : null;
        },
      };
      return { setup: grid.setup, choices: grid.choices, bot };
    }
  };
  const final = finalHandlers();
  if (final) return final;
  if (board) {
    const bot = boardBot(document);
    return {
      setup: board.setup,
      choices: board.choices,
      effects: board.effects,
      automatic: board.automatic,
      bot,
    };
  }
  return {};
}
