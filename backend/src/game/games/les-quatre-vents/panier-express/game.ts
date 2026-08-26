import {
  cards,
  clockwise,
  defineGame,
  diceKit,
  movement,
  playerView,
  quiz,
  victoryWhen,
  when,
} from '../../../core/application/public-api';
import {
  PANIER_EVENTS,
  PANIER_EXCHANGES,
  PANIER_LISTS,
  PANIER_PAWNS,
  PANIER_QUIZZES,
  PANIER_TILES,
} from './content';
import {
  PANIER_ACTIONS,
  requestPawn,
  resolveDirection,
  resolveGive,
  resolvePawn,
  resolveQuiz,
  resolveTake,
  resolveTarget,
  restoreMovement,
  skipPanierPlayer,
} from './rules';
import type { PanierPlayerView, PanierState } from './state';

export default defineGame<PanierState, typeof PANIER_ACTIONS, PanierPlayerView>(
  {
    id: 'panier-express',
    displayName: 'Panier Express',
    category: 'JeuxDePlateaux',
    subcategory: 'LesQuatreVents',
    description: 'Complétez votre liste de courses puis revenez à l’entrée.',
    players: { min: 2, max: 10 },
    components: [
      movement.track({ id: 'market', spaces: PANIER_TILES.length, wrap: true }),
      diceKit({ id: 'main', count: 1, sides: 6 }),
      cards.deck({ id: 'events', cards: PANIER_EVENTS, shuffle: true }),
      cards.deck({ id: 'exchanges', cards: PANIER_EXCHANGES, shuffle: true }),
      quiz.bank({
        id: 'market-quiz',
        questions: PANIER_QUIZZES,
        shuffle: true,
      }),
    ],
    shortcuts: [{ key: 'Space', type: 'action', actionType: 'roll' }],
    setup: ({ players, ctx }) => {
      const zeros = () =>
        Object.fromEntries(players.map((player) => [player.id, 0]));
      const selectedLists = ctx.random.shuffle(PANIER_LISTS);
      const state: PanierState = {
        pawnByPlayerId: {},
        setupComplete: false,
        starterId: (ctx.random.pick(players) ?? players[0]).id,
        shoppingLists: Object.fromEntries(
          players.map((player, index) => [
            player.id,
            [...selectedLists[index % selectedLists.length]],
          ]),
        ),
        baskets: Object.fromEntries(players.map((player) => [player.id, []])),
        inventories: Object.fromEntries(
          players.map((player) => [player.id, []]),
        ),
        laps: zeros(),
        skipTurns: zeros(),
        keepTurns: zeros(),
        revealTurns: zeros(),
        movementDirection: 1,
        reverseOwnerId: null,
        pending: null,
        resolvingPlayerId: null,
        lastEventId: null,
        lastExchangeId: null,
        winnerId: null,
      };
      requestPawn(state, players[0].id, ctx);
      return state;
    },
    initialPhase: 'setup',
    turn: clockwise(),
    actions: PANIER_ACTIONS,
    choices: {
      'panier.pawn': {
        resolve: ({ state, actor, value, ctx }) =>
          resolvePawn(state, actor.id, String(value), ctx),
      },
      'panier.direction': {
        resolve: ({ state, actor, value, ctx }) =>
          resolveDirection(state, actor.id, String(value), ctx),
      },
      'panier.quiz': {
        resolve: ({ state, actor, value, ctx }) =>
          resolveQuiz(state, actor.id, Number(value), ctx),
      },
      'panier.target': {
        resolve: ({ state, actor, value, ctx }) =>
          resolveTarget(state, actor.id, Number(value), ctx),
      },
      'panier.take': {
        resolve: ({ state, actor, value, ctx }) =>
          resolveTake(state, actor.id, String(value), ctx),
      },
      'panier.give': {
        resolve: ({ state, actor, value, ctx }) =>
          resolveGive(state, actor.id, String(value), ctx),
      },
    },
    automatic: [
      when(
        'restore-market-direction',
        ({ state, ctx }) =>
          state.setupComplete &&
          state.reverseOwnerId != null &&
          ctx.players.current()?.id === state.reverseOwnerId,
        ({ state, ctx }) => restoreMovement(state, ctx),
      ),
      when(
        'skip-market-turn',
        ({ state, ctx }) => {
          const playerId = ctx.players.current()?.id;
          return (
            state.setupComplete &&
            playerId != null &&
            state.skipTurns[playerId] > 0
          );
        },
        ({ state, ctx }) => skipPanierPlayer(state, ctx),
      ),
    ],
    victory: victoryWhen(({ state }) =>
      state.winnerId == null
        ? null
        : { winnerPlayerIds: [state.winnerId], reason: 'shopping-complete' },
    ),
    view: ({ state, actor, ctx }) => {
      const {
        shoppingLists: _shoppingLists,
        baskets: _baskets,
        inventories: _inventories,
        pending: _pending,
        resolvingPlayerId: _resolvingPlayerId,
        ...publicState
      } = state;
      const positions = Object.fromEntries(
        ctx.players
          .all()
          .map((player) => [
            player.id,
            ctx.movement.position('market', player.id),
          ]),
      );
      const basketCounts = Object.fromEntries(
        ctx.players
          .all()
          .map((player) => [player.id, state.baskets[player.id].length]),
      );
      const inventoryCounts = Object.fromEntries(
        ctx.players
          .all()
          .map((player) => [player.id, state.inventories[player.id].length]),
      );
      return playerView({
        game: {
          ...structuredClone(publicState),
          positions,
          basketCounts,
          inventoryCounts,
          shoppingList: actor ? [...state.shoppingLists[actor.id]] : [],
          basket: actor ? [...state.baskets[actor.id]] : [],
          inventory: actor ? [...state.inventories[actor.id]] : [],
        },
        extras: {
          pawn: actor
            ? (PANIER_PAWNS.find(
                (pawn) => pawn.id === state.pawnByPlayerId[actor.id],
              ) ?? null)
            : null,
        },
        board: { tiles: PANIER_TILES, positions },
      });
    },
    bot: { choose: () => ({ type: 'roll', payload: {} }) },
  },
);
