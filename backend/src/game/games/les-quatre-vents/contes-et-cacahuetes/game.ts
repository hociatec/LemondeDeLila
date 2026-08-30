import {
  cards,
  defineChoice,
  defineGame,
  defineGameContent,
  gameInput,
  pawns,
  publicField,
  raceGame,
  when,
} from '../../../engine/sdk/public-api';
import { CONTES_DECKS, CONTES_PAWNS, CONTES_TILES } from './content';
import {
  CONTES_ACTIONS,
  CONTES_PHASES,
  requestPawn,
  resolveCard,
  resolveLaughter,
  resolveOption,
  resolvePawn,
  resolveReroll,
  resolveToken,
  skipBlockedContesPlayer,
  unblockPassedPlayers,
} from './rules';
import { blockedPosition } from './resolution';
import { CONTES_EFFECTS } from './effects';
import type { ContesState } from './types';

export default defineGame<ContesState>()({
  id: 'contes-et-cacahuetes',
  displayName: 'Contes et Cacahuètes',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Une course narrative à travers les contes du monde.',
  players: { min: 2, max: 6 },
  content: defineGameContent('contes-et-cacahuetes', {
    tiles: CONTES_TILES,
    pawns: CONTES_PAWNS,
    decks: CONTES_DECKS,
  }),
  playerValuesVisibility: { statuses: publicField() },
  patterns: [
    raceGame({
      trackId: 'story-road',
      spaces: CONTES_TILES.length,
      overshoot: 'bounce',
    }),
  ],
  components: [
    pawns.set({ id: 'contes', pawns: CONTES_PAWNS }),
    cards.deck({
      id: 'bonus',
      cards: CONTES_DECKS.bonus,
      shuffle: true,
      empty: 'recycle',
    }),
    cards.deck({
      id: 'malus',
      cards: CONTES_DECKS.malus,
      shuffle: true,
      empty: 'recycle',
    }),
    cards.deck({
      id: 'surprise',
      cards: CONTES_DECKS.surprise,
      shuffle: true,
      empty: 'recycle',
    }),
    cards.deck({
      id: 'conte',
      cards: CONTES_DECKS.conte,
      shuffle: true,
      empty: 'recycle',
    }),
  ],
  initialization: { firstPlayer: 'random', startRound: true },
  shortcuts: [{ key: 'Space', type: 'action', actionType: 'roll' }],
  setup: ({ players, ctx }) => {
    requestPawn(players[0].id, ctx);
    return {};
  },
  initialPhase: CONTES_PHASES.initialPhase,
  phases: CONTES_PHASES.phases,
  actions: CONTES_ACTIONS,
  effects: CONTES_EFFECTS,
  choices: {
    'contes.pawn': defineChoice<ContesState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ actor, value, ctx }) => resolvePawn(actor.id, value, ctx),
    }),
    'contes.reroll': defineChoice<ContesState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ state, actor, value, ctx }) =>
        resolveReroll(state, actor.id, value, ctx),
    }),
    'contes.option': defineChoice<ContesState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ state, actor, value, ctx }) =>
        resolveOption(state, actor.id, value, ctx),
    }),
    'contes.number': defineChoice<ContesState, number>({
      input: gameInput.number({ integer: true }),
      resolve: ({ state, actor, value, ctx }) =>
        resolveLaughter(state, actor.id, value, ctx),
    }),
    'contes.card': defineChoice<ContesState, number>({
      input: gameInput.number({ integer: true }),
      resolve: ({ state, actor, value, ctx }) =>
        resolveCard(state, actor.id, value, ctx),
    }),
    'contes.token': defineChoice<ContesState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ state, actor, value, ctx }) =>
        resolveToken(state, actor.id, value, ctx),
    }),
  },
  automatic: [
    when(
      'unblock-passed-player',
      ({ state: _state, ctx }) => {
        const player = ctx.players.current();
        const blocked = player ? blockedPosition(ctx, player.id) : null;
        return (
          CONTES_PHASES.is(ctx, 'playing') &&
          player != null &&
          blocked != null &&
          ctx.players
            .all()
            .some(
              (other) =>
                other.id !== player.id &&
                ctx.movement.position('story-road', other.id) >= blocked,
            )
        );
      },
      ({ state, ctx }) => unblockPassedPlayers(state, ctx),
    ),
    when(
      'skip-sleeping-or-blocked-player',
      ({ state: _state, ctx }) => {
        const player = ctx.players.current();
        return (
          CONTES_PHASES.is(ctx, 'playing') &&
          player != null &&
          blockedPosition(ctx, player.id) != null
        );
      },
      ({ state, ctx }) => skipBlockedContesPlayer(state, ctx),
    ),
  ],
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
