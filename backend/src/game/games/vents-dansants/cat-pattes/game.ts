import {
  cards,
  defineGame,
  playerView,
  standardTurn,
  victoryWhen,
} from '../../../core/application/public-api';
import {
  CAT_PATTES_CARD_BY_ID,
  CAT_PATTES_DECK,
  CAT_PATTES_DEFAULT_ROUNDS,
} from './content';
import {
  CAT_PATTES_ACTIONS,
  initialPlayerRecord,
  playableInputs,
  requestRounds,
  resolveRounds,
} from './rules';
import type { CatPattesPlayerView, CatPattesState } from './state';

export default defineGame<
  CatPattesState,
  typeof CAT_PATTES_ACTIONS,
  CatPattesPlayerView
>({
  id: 'cat-pattes',
  displayName: 'Cat Pattes !',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: 'Course féline jusqu’à 1 000 pattes.',
  players: { min: 2, max: 6 },
  components: [
    cards.deck({
      id: 'cat-pattes',
      cards: CAT_PATTES_DECK.map((card) => card.id),
      shuffle: true,
    }),
    cards.hands({
      id: 'players',
      deck: 'cat-pattes',
      initial: 6,
      visibility: 'owner',
    }),
  ],
  shortcuts: [
    { key: 'Space', type: 'action', actionType: 'draw' },
    { key: 'Enter', type: 'action', actionType: 'play_card' },
    { key: 'D', type: 'action', actionType: 'discard_card' },
  ],
  setup: ({ players, ctx }) => {
    const state: CatPattesState = {
      ownerPlayerId:
        players.find((player) => !player.isBot)?.id ?? players[0].id,
      configComplete: false,
      roundsToPlay: CAT_PATTES_DEFAULT_ROUNDS,
      completedRounds: 0,
      positions: initialPlayerRecord(ctx, () => 0),
      points: initialPlayerRecord(ctx, () => 0),
      obstacles: initialPlayerRecord(ctx, () => null),
      powers: initialPlayerRecord(ctx, () => []),
      turboPlayed: initialPlayerRecord(ctx, () => 0),
      hasSun: initialPlayerRecord(ctx, () => false),
      sunReady: initialPlayerRecord(ctx, () => true),
      obstacleLock: initialPlayerRecord(ctx, () => false),
      drawnPlayerId: null,
      winnerId: null,
    };
    ctx.turn.to(state.ownerPlayerId);
    requestRounds(state, ctx);
    return state;
  },
  initialPhase: 'setup',
  turn: standardTurn(),
  actions: CAT_PATTES_ACTIONS,
  choices: {
    'cat-pattes.rounds': {
      resolve: ({ state, value, ctx }) =>
        resolveRounds(state, Number(value), ctx),
    },
  },
  victory: victoryWhen(({ state }) =>
    state.winnerId == null
      ? null
      : { winnerPlayerIds: [state.winnerId], reason: 'most-pattes' },
  ),
  view: ({ state, actor, ctx }) => {
    const hand = actor ? ctx.cards.hand<string>('players', actor.id) : [];
    return playerView({
      game: {
        ...structuredClone(state),
        hand: structuredClone(hand),
        handCounts: ctx.cards.handCounts('players'),
        deckCount: ctx.cards.deckCount('cat-pattes'),
        discardCount: ctx.cards.discardCount('cat-pattes'),
      },
      extras: {
        hand: hand.map((cardId) => CAT_PATTES_CARD_BY_ID[cardId]),
        handCounts: ctx.cards.handCounts('players'),
        positions: structuredClone(state.positions),
        points: structuredClone(state.points),
        obstacles: structuredClone(state.obstacles),
        powers: structuredClone(state.powers),
      },
    });
  },
  bot: {
    choose: ({ state, actor, ctx }) => {
      if (state.drawnPlayerId !== actor.id) {
        return { type: 'draw', payload: {} };
      }
      const input = playableInputs(state, actor.id, ctx)[0];
      if (input) return { type: 'play_card', payload: { ...input } };
      const cardId = ctx.cards.hand<string>('players', actor.id)[0];
      return {
        type: 'discard_card',
        payload: cardId ? { cardId } : {},
      };
    },
  },
});
