import {
  cards,
  cardGame,
  defineGame,
  playerView,
} from '../../../core/application/public-api';
import {
  DAME_NATURE_CARD_BY_ID,
  DAME_NATURE_FAMILY_CARD_DEFINITIONS,
  DAME_NATURE_FAMILY_CARD_IDS,
  DAME_NATURE_NATURE_CARD_IDS,
  DAME_NATURE_QUIZ_CARD_IDS,
} from './content';
import { DAME_NATURE_ACTIONS, DAME_NATURE_POLLUTION } from './rules';
import type { DameNaturePlayerView, DameNatureState } from './state';

const familySets = cards.sets({
  id: 'nature-families',
  hand: 'players',
  deck: 'nature',
  visibility: 'public',
  sets: DAME_NATURE_FAMILY_CARD_DEFINITIONS.reduce<Record<string, string[]>>(
    (sets, card) => {
      (sets[card.familyId] ??= []).push(card.id);
      return sets;
    },
    {},
  ),
});

export default defineGame<
  DameNatureState,
  typeof DAME_NATURE_ACTIONS,
  DameNaturePlayerView
>({
  id: 'dame-nature',
  displayName: 'Dame Nature',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: 'Réunissez quatre familles avant le pic de pollution.',
  players: { min: 2, max: 6 },
  patterns: [
    cardGame({
      deckId: 'nature',
      handId: 'players',
      cards: DAME_NATURE_FAMILY_CARD_IDS,
      initialHandSize: 5,
    }),
  ],
  components: [familySets],
  initialization: {
    counters: { [DAME_NATURE_POLLUTION]: 0 },
    startRound: false,
  },
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'ask_card' },
    { key: 'S', type: 'action', actionType: 'pass' },
  ],
  setup: ({ ctx }) => {
    ctx.cards.putOnTop('nature', [
      ...DAME_NATURE_QUIZ_CARD_IDS,
      ...DAME_NATURE_NATURE_CARD_IDS,
    ]);
    ctx.cards.shuffle('nature');
    return {};
  },
  actions: DAME_NATURE_ACTIONS,
  view: ({ state: _state, ctx }) => {
    const result = ctx.match.result();
    const lastQuizCardId =
      [...ctx.cards.discardPile<string>('nature')]
        .reverse()
        .find((cardId) => DAME_NATURE_CARD_BY_ID[cardId]?.type === 'quiz') ??
      null;
    const pollutionLoserId =
      result?.reason === 'pollution-limit'
        ? (ctx.players
            .all()
            .find((player) => !result.winnerPlayerIds.includes(player.id))
            ?.id ?? null)
        : null;
    const pollutionTokens = ctx.counters.get(DAME_NATURE_POLLUTION);
    return playerView({
      game: {
        pollutionTokens,
        pollutionLoserId,
        lastQuizCardId,
      },
      extras: {
        cardCatalog: DAME_NATURE_CARD_BY_ID,
        pollutionTokens,
      },
    });
  },
  bot: {
    choose: ({ actor, ctx }) => {
      const target = ctx.players.all().find((player) => player.id !== actor.id);
      const cardId =
        DAME_NATURE_FAMILY_CARD_IDS[
          ctx.random.int(DAME_NATURE_FAMILY_CARD_IDS.length)
        ];
      return target
        ? { type: 'ask_card', payload: { targetPlayerId: target.id, cardId } }
        : { type: 'pass', payload: {} };
    },
  },
});
