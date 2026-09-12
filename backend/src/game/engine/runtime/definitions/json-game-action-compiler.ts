import type { GameActionShape } from '../contracts/author-rule-contracts';
import { defineAction } from './game-definition-builders';
import { gameInput } from '../actions/game-input-schema';
import { cardSelectionRules } from '../recipes/gameplay/card-selection.recipes';
import type { CompiledJsonPrograms } from './json-game-program-compiler';
import type { JsonGameDocument } from './json-game-schema';

type JsonFailure = (path: string, reason: string) => never;

export function compileJsonActions(
  document: JsonGameDocument,
  programs: CompiledJsonPrograms,
  fail: JsonFailure,
) {
  const commonRecipes = () => ({
    'board-roll': programs.board?.roll,
    'board-draw': programs.board?.draw,
    'grid-place': programs.grid?.play,
    'judged-submit-card': programs.judged?.submit,
    'judged-pick': programs.judged?.pick,
    'event-race-roll': programs.eventRace?.roll,
    'delivery-race-roll': programs.deliveryRace?.roll,
    'goose-race-roll': programs.gooseRace?.roll,
    'collection-race-roll': programs.collectionRace?.roll,
    'ecosystem-race-roll': programs.ecosystemRace?.roll,
    'pirate-race-roll': programs.pirateRace?.roll,
    'parade-play': programs.parade?.play,
    'parade-pass': programs.parade?.pass,
    'nature-families-ask': programs.natureFamilies?.ask,
    'nature-families-pass': programs.natureFamilies?.pass,
    'car-assembly-play': programs.carAssembly?.play,
    'car-assembly-discard': programs.carAssembly?.discard,
    'car-assembly-pass': programs.carAssembly?.pass,
    'cat-pattes-draw': programs.catPattes?.draw,
    'cat-pattes-play': programs.catPattes?.play,
    'cat-pattes-discard': programs.catPattes?.discard,
    'contes-roll': programs.contes?.roll,
    'wonder-market-buy': programs.wonderMarket?.buy,
    'wonder-market-sell': programs.wonderMarket?.sell,
    'wonder-market-rumor': programs.wonderMarket?.rumor,
    'wonder-market-protect': programs.wonderMarket?.protect,
    'wonder-market-steal': programs.wonderMarket?.steal,
    'wonder-market-pass': programs.wonderMarket?.pass,
    'maman-race-roll': programs.mamanRace?.roll,
    'card-circles-form': programs.cardCircles?.form,
    'card-circles-discard': programs.cardCircles?.discard,
    'card-circles-pass': programs.cardCircles?.pass,
    'mine-domain-play': programs.mineDomain?.play,
    'mine-domain-pass': programs.mineDomain?.pass,
  });
  const specializedRecipes = () => ({
    'frousse-race-roll': programs.frousseRace?.roll,
    'galopons-race-roll': programs.galoponsRace?.roll,
    'profession-families-request': programs.professionFamilies?.request,
    'foulees-race-roll': programs.fouleesRace?.roll,
    'galaxy-race-roll': programs.galaxyRace?.roll,
    'midnight-race-roll': programs.midnightRace?.roll,
    'banana-troops-play': programs.bananaTroops?.play,
    'banana-troops-pass': programs.bananaTroops?.pass,
    'balloon-race-roll': programs.balloonRace?.roll,
    'balloon-race-draw': programs.balloonRace?.draw,
    'voyage-roll': programs.voyage?.roll,
    'derape-race-roll': programs.derapeRace?.roll,
    'nawak-choose': programs.nawak?.choose,
    'nawak-vote': programs.nawak?.vote,
    'olympia-draw': programs.olympia?.draw,
    'olympia-play': programs.olympia?.play,
    'olympia-pass': programs.olympia?.pass,
    'zig-et-zag-draw': programs.zigEtZag?.draw,
    'mnemosyne-draw': programs.mnemosyne?.draw,
    'mnemosyne-answer': programs.mnemosyne?.answer,
    'mnemosyne-timeout': programs.mnemosyne?.timeout,
    'corridor-move': programs.corridor?.move,
    'corridor-place-wall': programs.corridor?.placeWall,
    'lama-play': programs.lama?.play,
    'lama-draw': programs.lama?.draw,
    'lama-pass': programs.lama?.pass,
    'lama-quit': programs.lama?.quit,
    'pawn-race-roll': programs.pawnRace?.roll,
    'gerard-set-theme': programs.gerard?.setTheme,
    'gerard-play-name': programs.gerard?.playName,
    'gerard-play-special': programs.gerard?.playSpecial,
    'gerard-choose-winner': programs.gerard?.chooseWinner,
    'gerard-pass': programs.gerard?.pass,
    'rites-ask-card': programs.rites?.ask,
    'rites-pass': programs.rites?.pass,
    'sac-roll': programs.sac?.roll,
    'sac-build': programs.sac?.build,
    'sac-sell-building': programs.sac?.sell,
    'sac-mortgage': programs.sac?.mortgage,
    'sac-unmortgage': programs.sac?.unmortgage,
    'sac-pay-fine': programs.sac?.payFine,
    'sac-use-jail-card': programs.sac?.useJailCard,
  });
  const recipes = { ...commonRecipes(), ...specializedRecipes() };
  const actions: Record<
    string,
    GameActionShape<Record<string, never>>
  > = Object.fromEntries(
    Object.entries(document.actions).map(([id, action]) => {
      const compiled =
        'selectCards' in action
          ? cardSelectionRules(action.selectCards).action
          : 'recipe' in action
            ? (recipes[action.recipe] ??
              fail(`actions.${id}`, 'recipe program required'))
            : defineAction<Record<string, never>, Record<string, never>>({
                input: gameInput.object({}),
                execute: ({ ctx }) => ctx.effects.run(...action.effects),
              });
      return [
        id,
        action.documentation === undefined
          ? compiled
          : { ...compiled, documentation: action.documentation },
      ];
    }),
  );
  return actions;
}
