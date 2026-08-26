import {
  cards,
  cardGame,
  defineGame,
  playerView,
} from '../../../core/application/public-api';
import {
  OLYMPIA_CARD_BY_ID,
  OLYMPIA_DECKS,
  isOlympiaStatusKey,
  type OlympiaDeckType,
} from './content';
import {
  drawnPlayerId,
  OLYMPIA_ACTIONS,
  OLYMPIA_EFFECTS,
} from './rules';
import type { OlympiaPlayerView, OlympiaState } from './state';

const DECKS: OlympiaDeckType[] = [
  'divinite',
  'heros',
  'creatures',
  'exploits',
  'actions',
  'attaques',
  'evenements',
];

export default defineGame<
  OlympiaState,
  typeof OLYMPIA_ACTIONS,
  OlympiaPlayerView
>({
  id: 'olympia',
  displayName: 'Olympia',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: 'Gagnez le prestige suprême du panthéon.',
  players: { min: 2, max: 6 },
  patterns: [
    cardGame({
      deckId: 'heros',
      handId: 'players',
      cards: OLYMPIA_DECKS.heros,
    }),
    cardGame({
      deckId: 'divinite',
      handId: 'divinities',
      cards: OLYMPIA_DECKS.divinite,
      visibility: 'public',
    }),
  ],
  components: [
    ...DECKS.filter((id) => id !== 'heros' && id !== 'divinite').map((id) =>
      cards.deck({ id, cards: OLYMPIA_DECKS[id], shuffle: true }),
    ),
  ],
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'play_card' },
    { key: 'P', type: 'action', actionType: 'pass' },
  ],
  setup: ({ players, ctx }) => {
    for (const player of players) {
      const divinity = ctx.cards.draw<string>('divinite');
      if (divinity) ctx.cards.give('divinities', player.id, divinity);
      for (let index = 0; index < 2; index += 1) {
        const creature = ctx.cards.draw<string>('creatures');
        if (creature) ctx.cards.give('players', player.id, creature);
      }
      const action =
        ctx.cards.draw<string>('actions') ?? ctx.cards.draw<string>('attaques');
      if (action) ctx.cards.give('players', player.id, action);
    }
    return {};
  },
  actions: OLYMPIA_ACTIONS,
  effects: OLYMPIA_EFFECTS,
  view: ({ state, ctx }) => {
    const divinity = Object.fromEntries(
      ctx.players
        .all()
        .map((player) => [
          player.id,
          ctx.cards.hand<string>('divinities', player.id)[0] ?? '',
        ]),
    );
    const prestige = Object.fromEntries(
      ctx.players.all().map((player) => [player.id, ctx.score.get(player.id)]),
    );
    const statuses = Object.fromEntries(
      ctx.players.all().map((player) => [
        player.id,
        ctx.status
          .list(player.id)
          .filter((status) => isOlympiaStatusKey(status.id))
          .map((status) => {
            const value = status.data.value;
            return {
              key: status.id,
              turns: status.remaining ?? 0,
              ...(typeof value === 'number' ? { value } : {}),
            };
          }),
      ]),
    );
    const skipTurns = Object.fromEntries(
      ctx.players
        .all()
        .map((player) => [player.id, ctx.turn.skipCount(player.id)]),
    );
    return playerView({
      game: {
        divinity,
        prestige,
        statuses,
        drawnPlayerId: drawnPlayerId(ctx),
        winnerIds: ctx.match.result()?.winnerPlayerIds ?? [],
        skipTurns,
      },
      extras: {
        cardCatalog: OLYMPIA_CARD_BY_ID,
        prestige: structuredClone(prestige),
        divinity: structuredClone(divinity),
        statuses: structuredClone(statuses),
      },
    });
  },
  bot: {
    choose: ({ actor, ctx }) => {
      const cardId = ctx.cards.hand<string>('players', actor.id)[0];
      return cardId
        ? { type: 'play_card', payload: { cardId } }
        : { type: 'pass', payload: {} };
    },
  },
});
