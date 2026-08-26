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
import { FROUSSE_CARDS, FROUSSE_PAWNS, FROUSSE_TILES } from './content';
import {
  FROUSSE_ACTIONS,
  requestPawn,
  resolvePawn,
  resolveSwap,
  skipFroussePlayer,
} from './rules';
import type { FroussePlayerView, FrousseState } from './state';

export default defineGame<
  FrousseState,
  typeof FROUSSE_ACTIONS,
  FroussePlayerView
>({
  id: 'frousse-party',
  displayName: 'Frousse Party',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Course mouvementée dans un manoir hanté.',
  players: { min: 2, max: 6 },
  components: [
    movement.track({ id: 'manor', spaces: FROUSSE_TILES.length }),
    diceKit({ id: 'main', count: 1, sides: 6 }),
    cards.deck({ id: 'frights', cards: FROUSSE_CARDS, shuffle: true }),
  ],
  shortcuts: [{ key: 'Space', type: 'action', actionType: 'roll' }],
  setup: ({ players, ctx }) => {
    const zeros = () =>
      Object.fromEntries(players.map((player) => [player.id, 0]));
    const falses = () =>
      Object.fromEntries(players.map((player) => [player.id, false]));
    const state: FrousseState = {
      pawnByPlayerId: {},
      setupComplete: false,
      starterId: (ctx.random.pick(players) ?? players[0]).id,
      skipTurns: zeros(),
      ignoreNextTrap: falses(),
      ignoreTrapUntilNextDraw: falses(),
      ignoreNextPrank: falses(),
      ignoreNextGhost: falses(),
      nextMoveCap: zeros(),
      nextRollMalus: zeros(),
      nextRollKeepLowest: falses(),
      nextRollDouble: falses(),
      nextRollIfThreeBackTwo: falses(),
      blocked: Object.fromEntries(players.map((player) => [player.id, null])),
      replayTurns: zeros(),
      pendingSwap: null,
      winnerId: null,
    };
    requestPawn(state, players[0].id, ctx);
    return state;
  },
  initialPhase: 'setup',
  turn: clockwise(),
  actions: FROUSSE_ACTIONS,
  choices: {
    'frousse.pawn': {
      resolve: ({ state, actor, value, ctx }) =>
        resolvePawn(state, actor.id, String(value), ctx),
    },
    'frousse.swap': {
      resolve: ({ state, value, ctx }) =>
        resolveSwap(state, Number(value), ctx),
    },
  },
  automatic: [
    when(
      'skip-frightened-player',
      ({ state, ctx }) =>
        state.setupComplete &&
        (state.skipTurns[ctx.players.current()?.id ?? 0] ?? 0) > 0,
      ({ state, ctx }) => skipFroussePlayer(state, ctx),
    ),
  ],
  victory: victoryWhen(({ state }) =>
    state.winnerId == null
      ? null
      : { winnerPlayerIds: [state.winnerId], reason: 'escaped-manor' },
  ),
  view: ({ state, actor, ctx }) => {
    const { pendingSwap: _pendingSwap, ...publicState } = state;
    const positions = Object.fromEntries(
      ctx.players
        .all()
        .map((player) => [
          player.id,
          ctx.movement.position('manor', player.id),
        ]),
    );
    return playerView({
      game: {
        ...structuredClone(publicState),
        positions,
        deckCount:
          ctx.cards.deckCount('frights') + ctx.cards.discardCount('frights'),
      },
      extras: {
        pawn: actor
          ? (FROUSSE_PAWNS.find(
              (pawn) => pawn.id === state.pawnByPlayerId[actor.id],
            ) ?? null)
          : null,
      },
      board: { tiles: FROUSSE_TILES, positions },
    });
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
