import {
  cards,
  defineChoice,
  defineGame,
  gameInput,
  pawns,
  playerView,
  raceGame,
} from '../../../core/application/public-api';
import {
  A_FOND_LES_BALLONS_CARDS,
  A_FOND_LES_BALLONS_PAWNS,
  A_FOND_LES_BALLONS_TILES,
} from './content';
import {
  A_FOND_LES_BALLONS_ACTIONS,
  A_FOND_LES_BALLONS_EFFECTS,
  A_FOND_LES_BALLONS_PHASES,
  requestPawn,
  resolvePawn,
} from './rules';
import type { AFondLesBallonsPlayerView, AFondLesBallonsState } from './state';

export default defineGame<
  AFondLesBallonsState,
  typeof A_FOND_LES_BALLONS_ACTIONS,
  AFondLesBallonsPlayerView
>({
  id: 'a-fond-les-ballons',
  displayName: 'A fond les ballons !',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Course déjantée jusqu’à la Grosse Noix Dorée.',
  players: { min: 2, max: 6 },
  patterns: [
    raceGame({
      trackId: 'balloons',
      spaces: A_FOND_LES_BALLONS_TILES.length,
      overshoot: 'bounce',
    }),
  ],
  components: [
    pawns.set({ id: 'balloons', pawns: A_FOND_LES_BALLONS_PAWNS }),
    cards.deck({
      id: 'loufoque',
      cards: A_FOND_LES_BALLONS_CARDS,
      shuffle: true,
      empty: 'recycle',
    }),
  ],
  initialization: { firstPlayer: 'random', startRound: true },
  shortcuts: [{ key: 'Space', type: 'action', actionType: 'roll' }],
  setup: ({ ctx }) => {
    const starterId = ctx.round.starter();
    if (starterId != null) requestPawn(starterId, ctx);
    return {};
  },
  initialPhase: A_FOND_LES_BALLONS_PHASES.initialPhase,
  phases: A_FOND_LES_BALLONS_PHASES.phases,
  actions: A_FOND_LES_BALLONS_ACTIONS,
  effects: A_FOND_LES_BALLONS_EFFECTS,
  choices: {
    'a-fond-les-ballons.pawn': defineChoice<AFondLesBallonsState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ actor, value, ctx }) => resolvePawn(actor.id, value, ctx),
    }),
  },
  view: ({ actor, ctx }) => {
    const pawnByPlayerId = Object.fromEntries(
      ctx.players.all().flatMap((player) => {
        const pawnId = ctx.pawns.assigned('balloons', player.id)[0];
        return pawnId == null ? [] : [[player.id, pawnId]];
      }),
    );
    const positions = Object.fromEntries(
      ctx.players
        .all()
        .map((player) => [
          player.id,
          ctx.movement.position('balloons', player.id),
        ]),
    );
    const trapImmunityTurns = Object.fromEntries(
      ctx.players.all().map((player) => [
        player.id,
        ctx.status.get(player.id, 'a-fond-les-ballons.trap-immunity')
          ?.remaining ?? 0,
      ]),
    );
    const pending = ctx.choice.current();
    const swapPlayerId =
      pending?.data?.choiceId === 'a-fond-les-ballons.swap'
        ? (pending.playerId ?? null)
        : null;
    return playerView({
      game: {
        trapImmunityTurns,
        swapPlayerId,
        pawnByPlayerId,
        starterId: ctx.round.starter() ?? 0,
        lastRoll: ctx.dice.last('main')?.total ?? null,
        extraTurn: ctx.turn.extraCount() > 0,
        winnerId: ctx.match.result()?.winnerPlayerIds[0] ?? null,
        skipTurns: Object.fromEntries(
          ctx.players
            .all()
            .map((player) => [player.id, ctx.turn.skipCount(player.id)]),
        ),
        setupComplete: A_FOND_LES_BALLONS_PHASES.is(ctx, 'playing'),
        positions,
      },
      extras: {
        pawn: actor
          ? (A_FOND_LES_BALLONS_PAWNS.find(
              (pawn) => pawn.id === pawnByPlayerId[actor.id],
            ) ?? null)
          : null,
      },
      board: { tiles: A_FOND_LES_BALLONS_TILES, positions },
    });
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
