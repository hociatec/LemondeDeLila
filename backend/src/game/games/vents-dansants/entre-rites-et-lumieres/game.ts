import {
  cards,
  cardGame,
  defineChoice,
  defineGame,
  gameInput,
  inventory,
  playerView,
} from '../../../core/application/public-api';
import { ENTRE_RITES_CARD_BY_ID, ENTRE_RITES_DECK } from './content';
import {
  dealFamilyHands,
  ENTRE_RITES_ACTIONS,
  enumerateRequests,
  peaceTurnsRemaining,
  RITES_SILENCE,
  RITES_SPECIALS,
  resolveRitesCardChoice,
  resolveRitesFamilyChoice,
  resolveRitesStealChoice,
  statusOwner,
  type RitesStealChoice,
} from './rules';
import { ENTRE_RITES_EFFECTS } from './effects';
import type { EntreRitesPlayerView, EntreRitesState } from './state';

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

export default defineGame<
  EntreRitesState,
  typeof ENTRE_RITES_ACTIONS,
  EntreRitesPlayerView
>({
  id: 'entre-rites-et-lumieres',
  displayName: 'Entre Rites & Lumières !',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: 'Rassemblez les cinq familles pascales.',
  players: { min: 2, max: 6 },
  patterns: [
    cardGame({
      deckId: 'rites',
      handId: 'players',
      cards: ENTRE_RITES_DECK.map((card) => card.id),
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
  view: ({ ctx }) => {
    const specialsPlayed = ctx.players.byId((player) =>
      ctx.inventory.items(RITES_SPECIALS, player.id),
    );
    return playerView({
      game: {
        specialsPlayed,
        peaceTurnsRemaining: peaceTurnsRemaining(ctx),
        silenceOwnerId: statusOwner(RITES_SILENCE, ctx),
      },
      extras: {
        cardCatalog: ENTRE_RITES_CARD_BY_ID,
        specialsPlayedCount: ctx.players.byId(
          (player) => specialsPlayed[player.id].length,
        ),
      },
    });
  },
  bot: {
    choose: ({ actor, ctx }) => {
      const request =
        peaceTurnsRemaining(ctx) === 0
          ? enumerateRequests(actor.id, ctx)[0]
          : null;
      return request
        ? { type: 'ask_card', payload: request }
        : { type: 'pass', payload: {} };
    },
  },
});
