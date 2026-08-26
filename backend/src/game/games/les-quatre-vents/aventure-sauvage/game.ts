import {
  cards,
  defineChoice,
  defineEffect,
  defineGame,
  gameInput,
  pawns,
  playerView,
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
import type { AventureSauvagePlayerView, AventureSauvageState } from './state';

export default defineGame<
  AventureSauvageState,
  typeof AVENTURE_ACTIONS,
  AventureSauvagePlayerView
>({
  id: 'aventure-sauvage',
  displayName: 'Aventure Sauvage',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Une course animalière jusqu’à la mare de la jungle.',
  players: { min: 2, max: 6 },
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
  view: ({ actor, ctx }) => {
    const positions = ctx.players.byId((player) =>
      ctx.movement.position('jungle', player.id),
    );
    const pawnByPlayerId = Object.fromEntries(
      ctx.players.all().flatMap((player) => {
        const pawnId = ctx.pawns.assigned('avatars', player.id)[0];
        return pawnId == null ? [] : [[player.id, pawnId]];
      }),
    );
    const pawn = actor
      ? (AVENTURE_PAWNS.find(
          (entry) => entry.id === pawnByPlayerId[actor.id],
        ) ?? null)
      : null;
    return playerView({
      game: {
        pawnByPlayerId,
      },
      extras: {
        currentPlayerView: actor
          ? { id: actor.id, username: actor.username }
          : null,
        pawn,
      },
      board: { tiles: AVENTURE_TILES, positions },
    });
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
