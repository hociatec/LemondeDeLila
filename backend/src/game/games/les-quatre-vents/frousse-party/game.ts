import {
  cards,
  defineChoice,
  defineGame,
  gameInput,
  pawns,
  playerView,
  raceGame,
} from '../../../core/application/public-api';
import { FROUSSE_CARDS, FROUSSE_PAWNS, FROUSSE_TILES } from './content';
import {
  FROUSSE_ACTIONS,
  FROUSSE_EFFECTS,
  FROUSSE_PHASES,
  FROUSSE_STATUSES,
  blockedRule,
  requestPawn,
  resolvePawn,
  statusNumber,
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
  patterns: [
    raceGame({
      trackId: 'manor',
      spaces: FROUSSE_TILES.length,
      overshoot: 'bounce',
    }),
  ],
  components: [
    pawns.set({ id: 'frousse', pawns: FROUSSE_PAWNS }),
    cards.deck({
      id: 'frights',
      cards: FROUSSE_CARDS,
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
  initialPhase: FROUSSE_PHASES.initialPhase,
  phases: FROUSSE_PHASES.phases,
  actions: FROUSSE_ACTIONS,
  effects: FROUSSE_EFFECTS,
  choices: {
    'frousse.pawn': defineChoice<FrousseState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ actor, value, ctx }) => resolvePawn(actor.id, value, ctx),
    }),
  },
  view: ({ actor, ctx }) => {
    const pawnByPlayerId = Object.fromEntries(
      ctx.players.all().flatMap((player) => {
        const pawnId = ctx.pawns.assigned('frousse', player.id)[0];
        return pawnId == null ? [] : [[player.id, pawnId]];
      }),
    );
    const positions = Object.fromEntries(
      ctx.players
        .all()
        .map((player) => [
          player.id,
          ctx.movement.position('manor', player.id),
        ]),
    );
    const booleanMap = (statusId: string) =>
      Object.fromEntries(
        ctx.players
          .all()
          .map((player) => [player.id, ctx.status.has(player.id, statusId)]),
      );
    const numberMap = (statusId: string) =>
      Object.fromEntries(
        ctx.players
          .all()
          .map((player) => [player.id, statusNumber(player.id, statusId, ctx)]),
      );
    return playerView({
      game: {
        ignoreNextTrap: booleanMap(FROUSSE_STATUSES.ignoreNextTrap),
        ignoreTrapUntilNextDraw: booleanMap(
          FROUSSE_STATUSES.ignoreTrapUntilNextDraw,
        ),
        ignoreNextPrank: booleanMap(FROUSSE_STATUSES.ignoreNextPrank),
        ignoreNextGhost: booleanMap(FROUSSE_STATUSES.ignoreNextGhost),
        nextMoveCap: numberMap(FROUSSE_STATUSES.nextMoveCap),
        nextRollMalus: numberMap(FROUSSE_STATUSES.nextRollMalus),
        nextRollKeepLowest: booleanMap(
          FROUSSE_STATUSES.nextRollKeepLowest,
        ),
        nextRollDouble: booleanMap(FROUSSE_STATUSES.nextRollDouble),
        nextRollIfThreeBackTwo: booleanMap(
          FROUSSE_STATUSES.nextRollIfThreeBackTwo,
        ),
        blocked: Object.fromEntries(
          ctx.players
            .all()
            .map((player) => [player.id, blockedRule(player.id, ctx)]),
        ),
        pawnByPlayerId,
        starterId: ctx.round.starter() ?? 0,
        replayTurns: Object.fromEntries(
          ctx.players
            .all()
            .map((player) => [player.id, ctx.turn.extraCount(player.id)]),
        ),
        positions,
        winnerId: ctx.match.result()?.winnerPlayerIds[0] ?? null,
        skipTurns: Object.fromEntries(
          ctx.players
            .all()
            .map((player) => [player.id, ctx.turn.skipCount(player.id)]),
        ),
        setupComplete: FROUSSE_PHASES.is(ctx, 'playing'),
      },
      extras: {
        pawn: actor
          ? (FROUSSE_PAWNS.find(
              (pawn) => pawn.id === pawnByPlayerId[actor.id],
            ) ?? null)
          : null,
      },
      board: { tiles: FROUSSE_TILES, positions },
    });
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
