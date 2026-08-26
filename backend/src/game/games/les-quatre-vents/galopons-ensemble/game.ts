import {
  cards,
  clockwise,
  defineGame,
  diceKit,
  movement,
  playerView,
  victoryWhen,
  when,
} from '../../../core/application/public-api';
import { GALOPONS_CARDS, GALOPONS_PAWNS, GALOPONS_TILES } from './content';
import {
  GALOPONS_ACTIONS,
  requestPawn,
  resolvePawn,
  resolveTarget,
  skipGaloponsPlayer,
} from './rules';
import type { GaloponsPlayerView, GaloponsState } from './state';

export default defineGame<
  GaloponsState,
  typeof GALOPONS_ACTIONS,
  GaloponsPlayerView
>({
  id: 'galopons-ensemble',
  displayName: 'Galopons ensemble !',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Course équestre coopétitive avec pommes et aventures.',
  players: { min: 2, max: 4 },
  components: [
    movement.track({ id: 'galopons', spaces: GALOPONS_TILES.length }),
    diceKit({ id: 'main', count: 1, sides: 6 }),
    cards.deck({ id: 'adventure', cards: GALOPONS_CARDS, shuffle: true }),
  ],
  shortcuts: [{ key: 'Space', type: 'action', actionType: 'roll' }],
  setup: ({ players, ctx }) => {
    const state: GaloponsState = {
      pawnByPlayerId: {},
      setupComplete: false,
      starterId: players[0].id,
      apples: Object.fromEntries(players.map((player) => [player.id, 0])),
      movementDirection: Object.fromEntries(
        players.map((player) => [player.id, 1 as const]),
      ),
      ious: Object.fromEntries(players.map((player) => [player.id, {}])),
      skipTurns: Object.fromEntries(players.map((player) => [player.id, 0])),
      replay: false,
      targetKind: null,
      targetActorId: null,
      winnerId: null,
    };
    requestPawn(state, players[0].id, ctx);
    return state;
  },
  initialPhase: 'setup',
  turn: clockwise(),
  actions: GALOPONS_ACTIONS,
  choices: {
    'galopons.pawn': {
      resolve: ({ state, actor, value, ctx }) =>
        resolvePawn(state, actor.id, String(value), ctx),
    },
    'galopons.give-apple': {
      resolve: ({ state, value, ctx }) =>
        resolveTarget(state, 'give-apple', Number(value), ctx),
    },
    'galopons.help-advance': {
      resolve: ({ state, value, ctx }) =>
        resolveTarget(state, 'help-advance', Number(value), ctx),
    },
    'galopons.pair-advance': {
      resolve: ({ state, value, ctx }) =>
        resolveTarget(state, 'pair-advance', Number(value), ctx),
    },
  },
  automatic: [
    when(
      'skip-galopons-player',
      ({ state, ctx }) =>
        state.setupComplete &&
        (state.skipTurns[ctx.players.current()?.id ?? 0] ?? 0) > 0,
      ({ state, ctx }) => skipGaloponsPlayer(state, ctx),
    ),
  ],
  victory: victoryWhen(({ state }) =>
    state.winnerId == null
      ? null
      : { winnerPlayerIds: [state.winnerId], reason: 'three-apples-at-finish' },
  ),
  view: ({ state, actor, ctx }) => {
    const positions = Object.fromEntries(
      ctx.players
        .all()
        .map((player) => [
          player.id,
          ctx.movement.position('galopons', player.id),
        ]),
    );
    return playerView({
      game: {
        ...structuredClone(state),
        positions,
        deckCount:
          ctx.cards.deckCount('adventure') +
          ctx.cards.discardCount('adventure'),
      },
      extras: {
        pawn: actor
          ? (GALOPONS_PAWNS.find(
              (pawn) => pawn.id === state.pawnByPlayerId[actor.id],
            ) ?? null)
          : null,
        apples: structuredClone(state.apples),
      },
      board: { tiles: GALOPONS_TILES, positions },
    });
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
