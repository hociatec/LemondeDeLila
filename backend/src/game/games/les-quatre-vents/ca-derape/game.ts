import {
  cards,
  commonStatuses,
  defineChoice,
  defineGamePhases,
  defineGame,
  gameInput,
  playerView,
  raceGame,
  type PlayerMap,
  type GameContext,
} from '../../../core/application/public-api';
import { CA_DERAPE_CARDS, CA_DERAPE_TILES } from './content';
import {
  CA_DERAPE_ACTIONS,
  CA_IDLE_TURNS,
  CA_LAST_MOVE,
  CA_LAST_ROLL,
  CA_NEXT_PLAYER_DELTA,
  caResourceMap,
  mirrorSourceMap,
  resolveDeltaChoice,
} from './rules';
import { CA_DERAPE_EFFECTS } from './effects';
import type { CaDerapePlayerView, CaDerapeState } from './state';

const CA_DERAPE_PHASES = defineGamePhases<CaDerapeState>()({
  initialPhase: 'playing',
  phases: { playing: {} },
});

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
  patterns: [
    raceGame({ trackId: 'derape', spaces: CA_DERAPE_TILES.length }),
  ],
  components: [
    cards.deck({ id: 'situations', cards: CA_DERAPE_CARDS, shuffle: true }),
  ],
  initialization: {
    counters: { [CA_NEXT_PLAYER_DELTA]: 0 },
    startRound: false,
  },
  shortcuts: [{ key: 'Space', type: 'action', actionType: 'roll' }],
  initialPhase: CA_DERAPE_PHASES.initialPhase,
  phases: CA_DERAPE_PHASES.phases,
  actions: CA_DERAPE_ACTIONS,
  effects: CA_DERAPE_EFFECTS,
  choices: {
    'ca-derape.next-delta': defineChoice<CaDerapeState, number>({
      input: gameInput.number({ integer: true }),
      resolve: ({ value, ctx }) => resolveDeltaChoice(value, ctx),
    }),
  },
  view: ({ ctx }) => {
    const pending = ctx.choice.current();
    const choiceId = pending?.data.choiceId;
    const local = ctx.choice.data<{ kind?: string; actorId?: number }>();
    const pendingKind: import('./state').CaPendingKind | null =
      choiceId === 'ca-derape.swap'
        ? 'swap'
        : choiceId === 'ca-derape.next-player'
          ? 'next-player'
          : choiceId === 'ca-derape.mirror'
            ? 'mirror'
            : local?.kind === 'next-delta'
              ? 'next-delta'
              : null;
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
        lastRollByPlayer: caResourceMap(ctx, CA_LAST_ROLL),
        lastMoveDelta: caResourceMap(ctx, CA_LAST_MOVE),
        turnsSinceMoved: caResourceMap(ctx, CA_IDLE_TURNS),
        mirrorNextRollFrom: mirrorSourceMap(ctx),
        nextPlayerDelta: ctx.counters.get(CA_NEXT_PLAYER_DELTA) || null,
        pendingKind,
        pendingActorId: pendingKind ? pending?.playerId ?? null : null,
        ignoreNextPenalty: statusMap(ctx, commonStatuses.shield),
        doubleNextMove: statusMap(ctx, commonStatuses.doubleMove),
        doubleNextRoll: statusMap(ctx, commonStatuses.doubleRoll),
        extraTurn: ctx.turn.extraCount() > 0,
        winnerId: ctx.match.result()?.winnerPlayerIds[0] ?? null,
        skipTurns: Object.fromEntries(
          ctx.players.all().map((player) => [player.id, ctx.turn.skipCount(player.id)]),
        ),
        positions,
      },
      board: { tiles: CA_DERAPE_TILES, positions },
    });
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});

function statusMap(
  ctx: GameContext<CaDerapeState>,
  statusId: string,
): PlayerMap<boolean> {
  return Object.fromEntries(
    ctx.players
      .all()
      .map((player) => [player.id, ctx.status.has(player.id, statusId)]),
  );
}
