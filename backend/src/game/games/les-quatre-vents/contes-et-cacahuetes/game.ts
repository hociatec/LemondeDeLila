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
import { CONTES_DECKS, CONTES_PAWNS, CONTES_TILES } from './content';
import {
  CONTES_ACTIONS,
  replaceContesTurn,
  requestPawn,
  resolveCard,
  resolveLaughter,
  resolveOption,
  resolvePawn,
  resolveReroll,
  resolveTarget,
  resolveToken,
  skipContesPlayer,
  unblockPassedPlayers,
} from './rules';
import type { ContesPlayerView, ContesState } from './state';

export default defineGame<ContesState, typeof CONTES_ACTIONS, ContesPlayerView>(
  {
    id: 'contes-et-cacahuetes',
    displayName: 'Contes et Cacahuètes',
    category: 'JeuxDePlateaux',
    subcategory: 'LesQuatreVents',
    description: 'Une course narrative à travers les contes du monde.',
    players: { min: 2, max: 6 },
    components: [
      movement.track({ id: 'story-road', spaces: CONTES_TILES.length }),
      diceKit({ id: 'main', count: 1, sides: 6 }),
      cards.deck({ id: 'bonus', cards: CONTES_DECKS.bonus, shuffle: true }),
      cards.deck({ id: 'malus', cards: CONTES_DECKS.malus, shuffle: true }),
      cards.deck({
        id: 'surprise',
        cards: CONTES_DECKS.surprise,
        shuffle: true,
      }),
      cards.deck({ id: 'conte', cards: CONTES_DECKS.conte, shuffle: true }),
    ],
    shortcuts: [{ key: 'Space', type: 'action', actionType: 'roll' }],
    setup: ({ players, ctx }) => {
      const zeros = () =>
        Object.fromEntries(players.map((player) => [player.id, 0]));
      const falses = () =>
        Object.fromEntries(players.map((player) => [player.id, false]));
      const nulls = () =>
        Object.fromEntries(players.map((player) => [player.id, null]));
      const state: ContesState = {
        pawnByPlayerId: {},
        setupComplete: false,
        starterId: (ctx.random.pick(players) ?? players[0]).id,
        skipTurns: zeros(),
        rerollTokens: zeros(),
        shieldMalus: zeros(),
        protectNextMalus: falses(),
        cape: falses(),
        replaceOne: falses(),
        noBonusTurns: zeros(),
        forcedOneTurns: zeros(),
        reverseNextTurn: falses(),
        blockedAt: nulls(),
        turnReplacement: nulls(),
        activeSlotOwnerId: null,
        keyOfGold: falses(),
        pendingEffect: null,
        queuedDraws: [],
        resolvingPlayerId: null,
        lastConte: null,
        winnerId: null,
      };
      requestPawn(state, players[0].id, ctx);
      return state;
    },
    initialPhase: 'setup',
    turn: clockwise(),
    actions: CONTES_ACTIONS,
    choices: {
      'contes.pawn': {
        resolve: ({ state, actor, value, ctx }) =>
          resolvePawn(state, actor.id, String(value), ctx),
      },
      'contes.reroll': {
        resolve: ({ state, actor, value, ctx }) =>
          resolveReroll(state, actor.id, String(value), ctx),
      },
      'contes.target': {
        resolve: ({ state, actor, value, ctx }) =>
          resolveTarget(state, actor.id, Number(value), ctx),
      },
      'contes.option': {
        resolve: ({ state, actor, value, ctx }) =>
          resolveOption(state, actor.id, String(value), ctx),
      },
      'contes.number': {
        resolve: ({ state, actor, value, ctx }) =>
          resolveLaughter(state, actor.id, Number(value), ctx),
      },
      'contes.card': {
        resolve: ({ state, actor, value, ctx }) =>
          resolveCard(state, actor.id, Number(value), ctx),
      },
      'contes.token': {
        resolve: ({ state, actor, value, ctx }) =>
          resolveToken(state, actor.id, String(value), ctx),
      },
    },
    automatic: [
      when(
        'replace-exchanged-turn',
        ({ state, ctx }) => {
          const player = ctx.players.current();
          return (
            state.setupComplete &&
            state.activeSlotOwnerId == null &&
            player != null &&
            state.turnReplacement[player.id] != null
          );
        },
        ({ state, ctx }) => replaceContesTurn(state, ctx),
      ),
      when(
        'unblock-passed-player',
        ({ state, ctx }) => {
          const player = ctx.players.current();
          const blocked = player ? state.blockedAt[player.id] : null;
          return (
            state.setupComplete &&
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
            state.setupComplete &&
            player != null &&
            (state.skipTurns[player.id] > 0 ||
              state.blockedAt[player.id] != null)
          );
        },
        ({ state, ctx }) => skipContesPlayer(state, ctx),
      ),
    ],
    victory: victoryWhen(({ state }) =>
      state.winnerId == null
        ? null
        : { winnerPlayerIds: [state.winnerId], reason: 'story-road-finished' },
    ),
    view: ({ state, actor, ctx }) => {
      const {
        pendingEffect: _pendingEffect,
        queuedDraws: _queuedDraws,
        resolvingPlayerId: _resolvingPlayerId,
        activeSlotOwnerId: _activeSlotOwnerId,
        ...publicState
      } = state;
      const positions = Object.fromEntries(
        ctx.players
          .all()
          .map((player) => [
            player.id,
            ctx.movement.position('story-road', player.id),
          ]),
      );
      const deckCounts = {
        bonus: ctx.cards.deckCount('bonus') + ctx.cards.discardCount('bonus'),
        malus: ctx.cards.deckCount('malus') + ctx.cards.discardCount('malus'),
        surprise:
          ctx.cards.deckCount('surprise') + ctx.cards.discardCount('surprise'),
        conte: ctx.cards.deckCount('conte') + ctx.cards.discardCount('conte'),
      };
      return playerView({
        game: { ...structuredClone(publicState), positions, deckCounts },
        extras: {
          pawn: actor
            ? (CONTES_PAWNS.find(
                (pawn) => pawn.id === state.pawnByPlayerId[actor.id],
              ) ?? null)
            : null,
        },
        board: { tiles: CONTES_TILES, positions },
      });
    },
    bot: { choose: () => ({ type: 'roll', payload: {} }) },
  },
);
