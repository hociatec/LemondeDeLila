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
    const positions = ctx.players.byId((player) =>
      ctx.movement.position('manor', player.id),
    );
    const booleanMap = (statusId: string) =>
      ctx.players.byId((player) => ctx.status.has(player.id, statusId));
    const numberMap = (statusId: string) =>
      ctx.players.byId((player) => statusNumber(player.id, statusId, ctx));
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
        nextRollKeepLowest: booleanMap(FROUSSE_STATUSES.nextRollKeepLowest),
        nextRollDouble: booleanMap(FROUSSE_STATUSES.nextRollDouble),
        nextRollIfThreeBackTwo: booleanMap(
          FROUSSE_STATUSES.nextRollIfThreeBackTwo,
        ),
        blocked: ctx.players.byId((player) => blockedRule(player.id, ctx)),
        pawnByPlayerId,
        replayTurns: ctx.players.byId((player) =>
          ctx.turn.extraCount(player.id),
        ),
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
