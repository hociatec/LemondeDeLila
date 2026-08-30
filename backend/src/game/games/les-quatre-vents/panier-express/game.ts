import {
  cards,
  defineChoice,
  defineGameContent,
  defineGame,
  gameInput,
  inventory,
  pawns,
  quizRace,
  when,
} from '../../../engine/sdk/public-api';
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
  PANIER_PHASES,
  requestPawn,
  resolveDirection,
  resolveGive,
  resolvePawn,
  resolveQuiz,
  resolveTake,
  restoreMovement,
  PANIER_REVERSED,
} from './rules';
import { PANIER_EFFECTS } from './effects';
import type { PanierState } from './types';

export default defineGame<PanierState>()({
  id: 'panier-express',
  displayName: 'Panier Express',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Complétez votre liste de courses puis revenez à l’entrée.',
  players: { min: 2, max: 10 },
  content: defineGameContent('panier-express', {
    tiles: PANIER_TILES,
    pawns: PANIER_PAWNS,
    quizzes: PANIER_QUIZZES,
    lists: PANIER_LISTS,
    events: PANIER_EVENTS,
    exchanges: PANIER_EXCHANGES,
  }),
  patterns: [
    quizRace({
      trackId: 'market',
      spaces: PANIER_TILES.length,
      overshoot: 'wrap',
      quizId: 'market-quiz',
      questions: PANIER_QUIZZES,
    }),
  ],
  components: [
    pawns.set({ id: 'panier', pawns: PANIER_PAWNS }),
    cards.deck({ id: 'events', cards: PANIER_EVENTS, shuffle: true }),
    cards.deck({ id: 'exchanges', cards: PANIER_EXCHANGES, shuffle: true }),
    inventory.set({ id: 'market-items', visibility: 'owner' }),
    inventory.set({ id: 'shopping-lists', visibility: 'owner' }),
    inventory.set({ id: 'shopping-baskets', visibility: 'owner' }),
  ],
  shortcuts: [{ key: 'Space', type: 'action', actionType: 'roll' }],
  setup: ({ players, ctx }) => {
    const selectedLists = ctx.random.shuffle(PANIER_LISTS);
    const starter = ctx.random.pick(players) ?? players[0];
    ctx.round.start(starter.id);
    for (const [index, player] of players.entries()) {
      for (const item of selectedLists[index % selectedLists.length]) {
        ctx.inventory.add('shopping-lists', player.id, item);
      }
    }
    requestPawn(players[0].id, ctx);
    return {};
  },
  initialPhase: PANIER_PHASES.initialPhase,
  phases: PANIER_PHASES.phases,
  actions: PANIER_ACTIONS,
  effects: PANIER_EFFECTS,
  choices: {
    'panier.pawn': defineChoice<PanierState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ actor, value, ctx }) => resolvePawn(actor.id, value, ctx),
    }),
    'panier.direction': defineChoice<PanierState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ state, actor, value, ctx }) =>
        resolveDirection(state, actor.id, value, ctx),
    }),
    'panier.quiz': defineChoice<PanierState, number>({
      input: gameInput.number({ integer: true }),
      resolve: ({ state, actor, value, ctx }) =>
        resolveQuiz(state, actor.id, value, ctx),
    }),
    'panier.take': defineChoice<PanierState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ actor, value, ctx }) => resolveTake(actor.id, value, ctx),
    }),
    'panier.give': defineChoice<PanierState, string>({
      input: gameInput.string({ min: 1, max: 128 }),
      resolve: ({ actor, value, ctx }) => resolveGive(actor.id, value, ctx),
    }),
  },
  automatic: [
    when(
      'restore-market-direction',
      ({ ctx }) => {
        const current = ctx.players.current();
        return (
          PANIER_PHASES.is(ctx, 'playing') &&
          current != null &&
          ctx.status.has(current.id, PANIER_REVERSED)
        );
      },
      ({ ctx }) => {
        const playerId = ctx.players.current()?.id;
        if (playerId != null) restoreMovement(playerId, ctx);
      },
    ),
  ],
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
