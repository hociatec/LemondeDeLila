import {
  cards,
  defineChoice,
  defineEffect,
  defineGame,
  defineGameContent,
  gameInput,
  pawns,
  raceGame,
} from '../../../core/application/public-api';
import {
  AVENTURE_ANIMAL_CARDS,
  AVENTURE_PATTE_CARDS,
  AVENTURE_PAWNS,
  AVENTURE_TILES,
} from './content';
import {
  AVENTURE_ACTIONS,
  AVENTURE_PHASES,
  requestPawn,
  resolveAventureTile,
  resolvePawnChoice,
} from './rules';
import type { AventureSauvageState } from './state';

export default defineGame<AventureSauvageState, typeof AVENTURE_ACTIONS>({
  id: 'aventure-sauvage',
  displayName: 'Aventure Sauvage',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Une course animalière jusqu’à la mare de la jungle.',
  players: { min: 2, max: 6 },
  content: defineGameContent('aventure-sauvage', {
    tiles: AVENTURE_TILES,
    pawns: AVENTURE_PAWNS,
    animalCards: AVENTURE_ANIMAL_CARDS,
    pawCards: AVENTURE_PATTE_CARDS,
  }),
  patterns: [
    raceGame({
      trackId: 'jungle',
      spaces: AVENTURE_TILES.length,
      winOnFinish: 'jungle-finish',
    }),
  ],
  components: [
    pawns.set({ id: 'avatars', pawns: AVENTURE_PAWNS }),
    cards.deck({ id: 'animal', cards: AVENTURE_ANIMAL_CARDS, shuffle: true }),
    cards.deck({ id: 'patte', cards: AVENTURE_PATTE_CARDS, shuffle: true }),
  ],
  shortcuts: [
    { key: 'D', type: 'action', actionType: 'roll' },
    { key: 'P', type: 'interface', id: 'position' },
  ],
  setup: ({ players, ctx }) => {
    const first = players[0];
    if (first) requestPawn(first.id, ctx);
    return {};
  },
  initialPhase: AVENTURE_PHASES.initialPhase,
  phases: AVENTURE_PHASES.phases,
  actions: AVENTURE_ACTIONS,
  effects: {
    'aventure.resolve-landing': defineEffect({
      input: gameInput.object({}),
      apply: ({ actorPlayerId, ctx }) => {
        if (actorPlayerId != null) resolveAventureTile(actorPlayerId, ctx);
      },
    }),
  },
  choices: {
    'aventure.pawn': defineChoice<AventureSauvageState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ actor, value, ctx }) =>
        resolvePawnChoice(actor.id, value, ctx),
    }),
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
