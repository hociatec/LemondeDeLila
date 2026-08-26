import {
  cards,
  defineChoice,
  defineGame,
  gameInput,
  pawns,
  playerView,
  raceGame,
  when,
} from '../../../core/application/public-api';
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
import {
  blockedPosition,
  CONTES_RESOURCES,
  CONTES_STATUSES,
} from './resolution';
import { CONTES_EFFECTS } from './effects';
import type { ContesPlayerView, ContesState } from './state';

export default defineGame<ContesState, typeof CONTES_ACTIONS, ContesPlayerView>(
  {
    id: 'contes-et-cacahuetes',
    displayName: 'Contes et Cacahuètes',
    category: 'JeuxDePlateaux',
    subcategory: 'LesQuatreVents',
    description: 'Une course narrative à travers les contes du monde.',
    players: { min: 2, max: 6 },
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
        ({ state, ctx }) => {
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
        ({ state, ctx }) => {
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
    view: ({ state, actor, ctx }) => {
      const pawnByPlayerId = Object.fromEntries(
        ctx.players.all().flatMap((player) => {
          const pawnId = ctx.pawns.assigned('contes', player.id)[0];
          return pawnId == null ? [] : [[player.id, pawnId]];
        }),
      );
      const numberMap = (value: (playerId: number) => number) =>
        Object.fromEntries(
          ctx.players.all().map((player) => [player.id, value(player.id)]),
        );
      const booleanMap = (statusId: string) =>
        Object.fromEntries(
          ctx.players
            .all()
            .map((player) => [player.id, ctx.status.has(player.id, statusId)]),
        );
      const lastConteEntry = [...ctx.events.messages()]
        .reverse()
        .find(
          (entry) =>
            entry.key === 'game.card.drawn' &&
            entry.params.deckId === 'conte',
        );
      const lastConteCardId = Number(lastConteEntry?.params.cardId);
      const lastContePlayerId = Number(lastConteEntry?.params.playerId);
      const lastConteCard = Number.isInteger(lastConteCardId)
        ? CONTES_DECKS.conte.find((card) => card.id === lastConteCardId)
        : null;
      const positions = Object.fromEntries(
        ctx.players
          .all()
          .map((player) => [
            player.id,
            ctx.movement.position('story-road', player.id),
          ]),
      );
      return playerView({
        game: {
          rerollTokens: numberMap((playerId) =>
            ctx.resources.get(playerId, CONTES_RESOURCES.reroll),
          ),
          shieldMalus: numberMap((playerId) =>
            ctx.resources.get(playerId, CONTES_RESOURCES.shield),
          ),
          protectNextMalus: booleanMap(CONTES_STATUSES.protectNextMalus),
          cape: booleanMap(CONTES_STATUSES.cape),
          replaceOne: booleanMap(CONTES_STATUSES.replaceOne),
          noBonusTurns: numberMap(
            (playerId) =>
              ctx.status.get(playerId, CONTES_STATUSES.noBonus)?.remaining ?? 0,
          ),
          forcedOneTurns: numberMap(
            (playerId) =>
              ctx.status.get(playerId, CONTES_STATUSES.forcedOne)?.remaining ?? 0,
          ),
          reverseNextTurn: booleanMap(CONTES_STATUSES.reverseNextTurn),
          blockedAt: Object.fromEntries(
            ctx.players
              .all()
              .map((player) => [player.id, blockedPosition(ctx, player.id)]),
          ),
          keyOfGold: booleanMap(CONTES_STATUSES.keyOfGold),
          pawnByPlayerId,
          lastConte:
            lastConteEntry &&
            Number.isInteger(lastContePlayerId) &&
            lastConteCard
              ? {
                  playerId: lastContePlayerId,
                  title: lastConteCard.title,
                  text: lastConteCard.text,
                  timestamp: lastConteEntry.timestamp ?? '',
                }
              : null,
          starterId: ctx.round.starter() ?? 0,
          turnReplacement: Object.fromEntries(
            ctx.players
              .all()
              .map((player) => [
                player.id,
                ctx.turn.replacementFor(player.id),
              ]),
          ),
          positions,
          winnerId: ctx.match.result()?.winnerPlayerIds[0] ?? null,
          skipTurns: Object.fromEntries(
            ctx.players
              .all()
              .map((player) => [player.id, ctx.turn.skipCount(player.id)]),
          ),
          setupComplete: CONTES_PHASES.is(ctx, 'playing'),
        },
        extras: {
          pawn: actor
            ? (CONTES_PAWNS.find(
                (pawn) => pawn.id === pawnByPlayerId[actor.id],
              ) ?? null)
            : null,
        },
        board: { tiles: CONTES_TILES, positions },
      });
    },
    bot: { choose: () => ({ type: 'roll', payload: {} }) },
  },
);
