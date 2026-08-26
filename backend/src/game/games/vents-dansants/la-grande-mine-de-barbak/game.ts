import {
  cards,
  clockwise,
  defineGame,
  playerView,
  victoryWhen,
  when,
} from '../../../core/application/public-api';
import { LA_GRANDE_MINE_CARD_BY_ID, LA_GRANDE_MINE_CARDS } from './content';
import {
  drawAtTurnStart,
  enumeratePlays,
  GRANDE_MINE_ACTIONS,
  scoreDomain,
  skipMinePlayer,
} from './rules';
import type { GrandeMinePlayerView, GrandeMineState } from './state';

const deck = cards.deck({
  id: 'mine',
  cards: LA_GRANDE_MINE_CARDS.map((card) => card.id),
  shuffle: true,
});
const hands = cards.hands({
  id: 'players',
  deck: 'mine',
  initial: 5,
  visibility: 'owner',
});

export default defineGame<
  GrandeMineState,
  typeof GRANDE_MINE_ACTIONS,
  GrandeMinePlayerView
>({
  id: 'la-grande-mine-de-barbak',
  displayName: 'La Grande Mine de Barbak !',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: 'Amassez le meilleur domaine avant l’effondrement.',
  players: { min: 2, max: 6 },
  components: [deck, hands],
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'play_card' },
    { key: 'S', type: 'action', actionType: 'pass' },
  ],
  setup: ({ players }) => ({
    domains: Object.fromEntries(
      players.map((player) => [player.id, { treasures: [], objects: [] }]),
    ),
    drawnPlayerId: null,
    skipTurns: Object.fromEntries(players.map((player) => [player.id, 0])),
    discardNextDraw: Object.fromEntries(
      players.map((player) => [player.id, false]),
    ),
    gameOver: false,
    winnerIds: [],
  }),
  turn: clockwise(),
  actions: GRANDE_MINE_ACTIONS,
  automatic: [
    when(
      'skip-mine-player',
      ({ state, ctx }) =>
        (state.skipTurns[ctx.players.current()?.id ?? 0] ?? 0) > 0,
      ({ state, ctx }) => skipMinePlayer(state, ctx),
    ),
    when(
      'draw-at-turn-start',
      ({ state, ctx }) =>
        !state.gameOver &&
        state.drawnPlayerId !== (ctx.players.current()?.id ?? null),
      ({ state, ctx }) => drawAtTurnStart(state, ctx),
    ),
  ],
  victory: victoryWhen(({ state }) =>
    state.gameOver
      ? { winnerPlayerIds: state.winnerIds, reason: 'mine-collapsed' }
      : null,
  ),
  view: ({ state, actor, ctx }) => {
    const hand = actor ? ctx.cards.hand<string>('players', actor.id) : [];
    const scores = Object.fromEntries(
      ctx.players
        .all()
        .map((player) => [player.id, scoreDomain(state.domains[player.id])]),
    );
    return playerView({
      game: {
        ...structuredClone(state),
        hand: structuredClone(hand),
        handCounts: ctx.cards.handCounts('players'),
        deckCount: ctx.cards.deckCount('mine'),
        discardCount: ctx.cards.discardCount('mine'),
        scores,
      },
      extras: {
        hand: hand.map((cardId) => LA_GRANDE_MINE_CARD_BY_ID[cardId]),
        handCounts: ctx.cards.handCounts('players'),
        domains: structuredClone(state.domains),
        scores,
      },
    });
  },
  bot: {
    choose: ({ actor, ctx }) => {
      const play = enumeratePlays(actor.id, ctx)[0];
      return play
        ? { type: 'play_card', payload: play }
        : { type: 'pass', payload: {} };
    },
  },
});
