import {
  cards,
  defineCardsSchema,
  defineChoice,
  defineEffect,
  defineGame,
  defineGameContent,
  gameInput,
  pawns,
  raceGame,
} from '../../../engine/sdk/public-api';
import { GALOPONS_CARDS, GALOPONS_PAWNS, GALOPONS_TILES } from './content';
import {
  GALOPONS_ACTIONS,
  GALOPONS_PHASES,
  giveAppleWithIou,
  helpAdvanceForApple,
  moveGaloponsAndResolve,
  moveToNextRegion,
  pairAdvance,
  requestPawn,
  resolvePawn,
} from './rules';
import type { NoGameState as GaloponsState } from '../../../engine/sdk/public-api';

const cardSchema = defineCardsSchema({
  decks: {
    adventure: cards.deck({
      id: 'adventure',
      cards: GALOPONS_CARDS,
      shuffle: true,
      empty: 'recycle',
    }),
  },
  hands: {},
});

export default defineGame<GaloponsState>()({
  id: 'galopons-ensemble',
  displayName: 'Galopons ensemble !',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Course équestre coopétitive avec pommes et aventures.',
  players: { min: 2, max: 4 },
  content: defineGameContent('galopons-ensemble', {
    cards: GALOPONS_CARDS,
    pawns: GALOPONS_PAWNS,
    tiles: GALOPONS_TILES,
  }),
  patterns: [raceGame({ trackId: 'galopons', spaces: GALOPONS_TILES.length })],
  components: [
    pawns.set({ id: 'galopons', pawns: GALOPONS_PAWNS }),
    ...cardSchema.components,
  ],
  initialization: { firstPlayer: 'first', startRound: true },
  shortcuts: [{ key: 'Space', type: 'action', actionType: 'roll' }],
  setup: ({ players, ctx }) => {
    requestPawn(players[0].id, ctx);
    return {};
  },
  initialPhase: GALOPONS_PHASES.initialPhase,
  phases: GALOPONS_PHASES.phases,
  actions: GALOPONS_ACTIONS,
  choices: {
    'galopons.pawn': defineChoice<GaloponsState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ actor, value, ctx }) => resolvePawn(actor.id, value, ctx),
    }),
  },
  effects: {
    'galopons.move': defineEffect<GaloponsState, { delta: number }>({
      input: gameInput.object({
        delta: gameInput.number({ integer: true }),
      }),
      apply: ({ state, actorPlayerId, data, ctx }) => {
        if (actorPlayerId != null) {
          moveGaloponsAndResolve(state, actorPlayerId, data.delta, 0, ctx);
        }
      },
    }),
    'galopons.move-to-region': defineEffect<
      GaloponsState,
      { region: 'foret' | 'montagne' }
    >({
      input: gameInput.object({
        region: gameInput.enum(['foret', 'montagne'] as const),
      }),
      apply: ({ state, actorPlayerId, data, ctx }) => {
        if (actorPlayerId != null) {
          moveToNextRegion(state, actorPlayerId, data.region, 0, ctx);
        }
      },
    }),
    'galopons.give-apple': defineEffect<GaloponsState, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ actorPlayerId, targetPlayerIds, ctx }) => {
        const targetId = targetPlayerIds[0];
        if (actorPlayerId != null && targetId != null) {
          giveAppleWithIou(actorPlayerId, targetId, ctx);
        }
      },
    }),
    'galopons.help-advance': defineEffect<GaloponsState, { delta: number }>({
      input: gameInput.object({
        delta: gameInput.number({ integer: true }),
      }),
      apply: ({ state, actorPlayerId, targetPlayerIds, data, ctx }) => {
        const targetId = targetPlayerIds[0];
        if (actorPlayerId != null && targetId != null) {
          helpAdvanceForApple(state, actorPlayerId, targetId, data.delta, ctx);
        }
      },
    }),
    'galopons.pair-advance': defineEffect<GaloponsState, { delta: number }>({
      input: gameInput.object({
        delta: gameInput.number({ integer: true }),
      }),
      apply: ({ state, actorPlayerId, targetPlayerIds, data, ctx }) => {
        const targetId = targetPlayerIds[0];
        if (actorPlayerId != null && targetId != null) {
          pairAdvance(state, actorPlayerId, targetId, data.delta, ctx);
        }
      },
    }),
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
