import {
  cards,
  defineChoice,
  defineEffect,
  defineGame,
  gameInput,
  pawns,
  playerView,
  raceGame,
  type PlayerMap,
} from '../../../core/application/public-api';
import { GALOPONS_CARDS, GALOPONS_PAWNS, GALOPONS_TILES } from './content';
import {
  GALOPONS_ACTIONS,
  GALOPONS_PHASES,
  galoponsIous,
  giveAppleWithIou,
  helpAdvanceForApple,
  moveAndLand,
  moveToNextRegion,
  pairAdvance,
  requestPawn,
  resolvePawn,
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
  patterns: [
    raceGame({ trackId: 'galopons', spaces: GALOPONS_TILES.length }),
  ],
  components: [
    pawns.set({ id: 'galopons', pawns: GALOPONS_PAWNS }),
    cards.deck({
      id: 'adventure',
      cards: GALOPONS_CARDS,
      shuffle: true,
      empty: 'recycle',
    }),
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
          moveAndLand(state, actorPlayerId, data.delta, 0, ctx);
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
    'galopons.give-apple': defineEffect<
      GaloponsState,
      Record<string, never>
    >({
      input: gameInput.object({}),
      apply: ({ actorPlayerId, targetPlayerIds, ctx }) => {
        const targetId = targetPlayerIds[0];
        if (actorPlayerId != null && targetId != null) {
          giveAppleWithIou(actorPlayerId, targetId, ctx);
        }
      },
    }),
    'galopons.help-advance': defineEffect<
      GaloponsState,
      { delta: number }
    >({
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
    'galopons.pair-advance': defineEffect<
      GaloponsState,
      { delta: number }
    >({
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
  view: ({ state, actor, ctx }) => {
    const pending = ctx.choice.current();
    const choiceId = pending?.data.choiceId;
    const targetKind =
      choiceId === 'galopons.give-apple'
        ? 'give-apple'
        : choiceId === 'galopons.help-advance'
          ? 'help-advance'
          : choiceId === 'galopons.pair-advance'
            ? 'pair-advance'
            : null;
    const pawnByPlayerId = Object.fromEntries(
      ctx.players.all().flatMap((player) => {
        const pawnId = ctx.pawns.assigned('galopons', player.id)[0];
        return pawnId == null ? [] : [[player.id, pawnId]];
      }),
    );
    const positions = Object.fromEntries(
      ctx.players
        .all()
        .map((player) => [
          player.id,
          ctx.movement.position('galopons', player.id),
        ]),
    );
    const apples = Object.fromEntries(
      ctx.players
        .all()
        .map((player) => [player.id, ctx.resources.get(player.id, 'apple')]),
    );
    const movementDirection: PlayerMap<1 | -1> = Object.fromEntries(
      ctx.players.all().map((player) => [
        player.id,
        ctx.status.has(player.id, 'galopons.returning') ? -1 : 1,
      ]),
    );
    return playerView({
      game: {
        ious: galoponsIous(ctx),
        apples,
        movementDirection,
        targetKind,
        targetActorId: targetKind == null ? null : (pending?.playerId ?? null),
        pawnByPlayerId,
        replay: ctx.turn.extraCount() > 0,
        starterId: ctx.round.starter() ?? 0,
        winnerId: ctx.match.result()?.winnerPlayerIds[0] ?? null,
        skipTurns: Object.fromEntries(
          ctx.players
            .all()
            .map((player) => [player.id, ctx.turn.skipCount(player.id)]),
        ),
        setupComplete: GALOPONS_PHASES.is(ctx, 'playing'),
        positions,
      },
      extras: {
        pawn: actor
          ? (GALOPONS_PAWNS.find(
              (pawn) => pawn.id === pawnByPlayerId[actor.id],
            ) ?? null)
          : null,
        apples: structuredClone(apples),
      },
      board: { tiles: GALOPONS_TILES, positions },
    });
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
