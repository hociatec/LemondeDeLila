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
import { CA_DERAPE_CARDS, CA_DERAPE_TILES } from './content';
import { CA_DERAPE_ACTIONS, resolveChoice, skipCaPlayer } from './rules';
import type { CaDerapePlayerView, CaDerapeState } from './state';

export default defineGame<
  CaDerapeState,
  typeof CA_DERAPE_ACTIONS,
  CaDerapePlayerView
>({
  id: 'ca-derape',
  displayName: 'Ça Dérape !',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Course chaotique sur 30 cases avec cartes Situation.',
  players: { min: 2, max: 10 },
  components: [
    movement.track({ id: 'derape', spaces: CA_DERAPE_TILES.length }),
    diceKit({ id: 'main', count: 1, sides: 6 }),
    cards.deck({ id: 'situations', cards: CA_DERAPE_CARDS, shuffle: true }),
  ],
  shortcuts: [{ key: 'Space', type: 'action', actionType: 'roll' }],
  setup: ({ players }) => ({
    lastRollByPlayer: Object.fromEntries(
      players.map((player) => [player.id, 0]),
    ),
    lastMoveDelta: Object.fromEntries(players.map((player) => [player.id, 0])),
    turnsSinceMoved: Object.fromEntries(
      players.map((player) => [player.id, 0]),
    ),
    skipTurns: Object.fromEntries(players.map((player) => [player.id, 0])),
    ignoreNextPenalty: Object.fromEntries(
      players.map((player) => [player.id, false]),
    ),
    doubleNextMove: Object.fromEntries(
      players.map((player) => [player.id, false]),
    ),
    doubleNextRoll: Object.fromEntries(
      players.map((player) => [player.id, false]),
    ),
    mirrorNextRollFrom: Object.fromEntries(
      players.map((player) => [player.id, null]),
    ),
    nextPlayerDelta: null,
    pendingKind: null,
    pendingActorId: null,
    extraTurn: false,
    winnerId: null,
  }),
  initialPhase: 'playing',
  turn: clockwise(),
  actions: CA_DERAPE_ACTIONS,
  choices: Object.fromEntries(
    (['swap', 'next-player', 'next-delta', 'mirror'] as const).map((kind) => [
      `ca-derape.${kind}`,
      {
        resolve: ({
          state,
          value,
          ctx,
        }: {
          state: CaDerapeState;
          value: unknown;
          ctx: Parameters<typeof resolveChoice>[3];
        }) => resolveChoice(state, kind, Number(value), ctx),
      },
    ]),
  ),
  automatic: [
    when(
      'skip-ca-player',
      ({ state, ctx }) =>
        (state.skipTurns[ctx.players.current()?.id ?? 0] ?? 0) > 0,
      ({ state, ctx }) => skipCaPlayer(state, ctx),
    ),
  ],
  victory: victoryWhen(({ state }) =>
    state.winnerId == null
      ? null
      : { winnerPlayerIds: [state.winnerId], reason: 'finish-line' },
  ),
  view: ({ state, ctx }) => {
    const positions = Object.fromEntries(
      ctx.players
        .all()
        .map((player) => [
          player.id,
          ctx.movement.position('derape', player.id),
        ]),
    );
    return playerView({
      game: {
        ...structuredClone(state),
        positions,
        deckCount:
          ctx.cards.deckCount('situations') +
          ctx.cards.discardCount('situations'),
      },
      board: { tiles: CA_DERAPE_TILES, positions },
    });
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
