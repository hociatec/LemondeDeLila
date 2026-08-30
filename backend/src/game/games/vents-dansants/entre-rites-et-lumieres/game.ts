import {
  cards,
  cardGame,
  defineCardsSchema,
  defineChoice,
  defineGame,
  defineGameContent,
  gameInput,
  inventory,
} from '../../../engine/sdk/public-api';
import { ENTRE_RITES_DECK } from './content';
import {
  dealFamilyHands,
  ENTRE_RITES_ACTIONS,
  enumerateRequests,
  RITES_PEACE,
  RITES_SILENCE,
  RITES_SPECIALS,
  resolveRitesCardChoice,
  resolveRitesFamilyChoice,
  resolveRitesStealChoice,
  type RitesStealChoice,
} from './rules';
import { ENTRE_RITES_EFFECTS } from './effects';
import type { EntreRitesState } from './types';

const familySets = cards.sets({
  id: 'rite-families',
  hand: 'players',
  deck: 'rites',
  visibility: 'public',
  sets: ENTRE_RITES_DECK.reduce<Record<string, string[]>>((sets, card) => {
    if (card.type === 'family') (sets[card.familyId] ??= []).push(card.id);
    return sets;
  }, {}),
});
const cardSchema = defineCardsSchema({
  decks: {
    rites: cards.deck({
      id: 'rites',
      cards: ENTRE_RITES_DECK.map((card) => card.id),
      shuffle: true,
      empty: 'recycle',
    }),
  },
  hands: {
    players: cards.hands({
      id: 'players',
      deck: 'rites',
      initial: 0,
      visibility: 'owner',
    }),
  },
});

export default defineGame<EntreRitesState>()({
  id: 'entre-rites-et-lumieres',
  displayName: 'Entre Rites & Lumières !',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: 'Rassemblez les cinq familles pascales.',
  players: { min: 2, max: 6 },
  content: defineGameContent('entre-rites-et-lumieres', {
    cards: ENTRE_RITES_DECK,
  }),
  patterns: [
    cardGame({
      schema: cardSchema,
      deckId: 'rites',
      handId: 'players',
    }),
  ],
  components: [
    familySets,
    inventory.set({ id: RITES_SPECIALS, visibility: 'public' }),
  ],
  shortcuts: [
    { key: 'D', type: 'action', actionType: 'ask_card' },
    { key: 'S', type: 'action', actionType: 'pass' },
  ],
  setup: ({ players, ctx }) => {
    dealFamilyHands(
      players.map((player) => player.id),
      ctx,
    );
    return {};
  },
  lifecycle: {
    beforeTurn: ({ ctx, player }) => {
      if (player) ctx.status.remove(player.id, RITES_SILENCE);
    },
  },
  actions: ENTRE_RITES_ACTIONS,
  effects: ENTRE_RITES_EFFECTS,
  choices: {
    'rites.card': defineChoice<EntreRitesState, string>({
      input: gameInput.cardId(),
      resolve: ({ state, value, ctx }) =>
        resolveRitesCardChoice(state, value, ctx),
    }),
    'rites.family': defineChoice<EntreRitesState, string[]>({
      input: gameInput.array(gameInput.cardId(), { min: 1 }),
      resolve: ({ state, value, ctx }) =>
        resolveRitesFamilyChoice(state, value, ctx),
    }),
    'rites.steal': defineChoice<EntreRitesState, RitesStealChoice>({
      input: gameInput.object({
        targetPlayerId: gameInput.playerId(),
        cardId: gameInput.cardId(),
      }),
      resolve: ({ state, value, ctx }) =>
        resolveRitesStealChoice(state, value, ctx),
    }),
  },
  bot: {
    choose: ({ actor, ctx }) => {
      const request = ctx.players
        .all()
        .every(
          (player) =>
            (ctx.status.get(player.id, RITES_PEACE)?.remaining ?? 0) === 0,
        )
        ? enumerateRequests(actor.id, ctx)[0]
        : null;
      return request
        ? { type: 'ask_card', payload: request }
        : { type: 'pass', payload: {} };
    },
  },
});
