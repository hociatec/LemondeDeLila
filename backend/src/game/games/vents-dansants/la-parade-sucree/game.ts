import {
  cards,
  cardGame,
  defineCardsSchema,
  defineGame,
  defineGameContent,
  victoryWhen,
} from '../../../engine/sdk/public-api';
import { PARADE_CARD_BY_ID, PARADE_CARDS, PARADE_SEQUENCE } from './content';
import { PARADE_ACTIONS, sequenceIndex, winners } from './rules';
import type { LaParadeSucreeState } from './types';

const cardSchema = defineCardsSchema({
  decks: {
    parade: cards.deck({
      id: 'parade',
      cards: PARADE_CARDS.map((card) => card.id),
      shuffle: true,
      empty: 'recycle',
    }),
  },
  hands: {
    players: cards.hands({
      id: 'players',
      deck: 'parade',
      initial: 0,
      visibility: 'owner',
    }),
  },
});

export default defineGame<LaParadeSucreeState>()({
  id: 'la-parade-sucree',
  displayName: 'La Parade Sucrée !',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: 'Posez les cartes dans l’ordre et collectionnez les friandises.',
  players: { min: 2, max: 6 },
  content: defineGameContent('la-parade-sucree', {
    cards: PARADE_CARDS,
    sequence: PARADE_SEQUENCE,
  }),
  patterns: [
    cardGame({
      schema: cardSchema,
      deckId: 'parade',
      handId: 'players',
    }),
  ],
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'play_card' },
    { key: 'S', type: 'action', actionType: 'pass' },
  ],
  setup: ({ players, ctx }) => {
    ctx.cards.deal(
      'parade',
      'players',
      players.map((player) => player.id),
      PARADE_CARDS.length,
    );
    return {};
  },
  actions: PARADE_ACTIONS,
  victory: victoryWhen(({ ctx }) => {
    const complete =
      sequenceIndex(ctx) >= PARADE_SEQUENCE.length ||
      ctx.players
        .all()
        .every((player) => ctx.cards.hand('players', player.id).length === 0);
    return complete
      ? { winnerPlayerIds: winners(ctx), reason: 'parade-complete' }
      : null;
  }),
  bot: {
    choose: ({ actor, ctx }) => {
      const expected = PARADE_SEQUENCE[sequenceIndex(ctx)];
      const cardId = ctx.cards
        .hand<string>('players', actor.id)
        .find((candidate) => PARADE_CARD_BY_ID[candidate]?.value === expected);
      return cardId
        ? { type: 'play_card', payload: { cardId } }
        : { type: 'pass', payload: {} };
    },
  },
});
