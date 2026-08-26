import {
  cards,
  clockwise,
  defineGame,
  playerView,
  victoryWhen,
  when,
} from '../../../core/application/public-api';
import {
  OLYMPIA_CARD_BY_ID,
  OLYMPIA_DECKS,
  type OlympiaDeckType,
} from './content';
import { OLYMPIA_ACTIONS, skipOlympiaPlayer } from './rules';
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
  components: [
    ...DECKS.map((id) =>
      cards.deck({ id, cards: OLYMPIA_DECKS[id], shuffle: true }),
    ),
    cards.hands({
      id: 'players',
      deck: 'heros',
      initial: 0,
      visibility: 'owner',
    }),
  ],
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'play_card' },
    { key: 'P', type: 'action', actionType: 'pass' },
  ],
  setup: ({ players, ctx }) => {
    const divinity: Record<number, string> = {};
    for (const player of players) {
      divinity[player.id] = ctx.cards.draw<string>('divinite') ?? '';
      for (let index = 0; index < 2; index += 1) {
        const creature = ctx.cards.draw<string>('creatures');
        if (creature) ctx.cards.give('players', player.id, creature);
      }
      const action =
        ctx.cards.draw<string>('actions') ?? ctx.cards.draw<string>('attaques');
      if (action) ctx.cards.give('players', player.id, action);
    }
    return {
      divinity,
      prestige: Object.fromEntries(players.map((player) => [player.id, 0])),
      statuses: Object.fromEntries(players.map((player) => [player.id, []])),
      skipTurns: Object.fromEntries(players.map((player) => [player.id, 0])),
      drawnPlayerId: null,
      winnerIds: [],
    };
  },
  turn: clockwise(),
  actions: OLYMPIA_ACTIONS,
  automatic: [
    when(
      'skip-olympia-player',
      ({ state, ctx }) =>
        (state.skipTurns[ctx.players.current()?.id ?? 0] ?? 0) > 0,
      ({ state, ctx }) => skipOlympiaPlayer(state, ctx),
    ),
  ],
  victory: victoryWhen(({ state }) =>
    state.winnerIds.length === 0
      ? null
      : { winnerPlayerIds: state.winnerIds, reason: 'prestige-30' },
  ),
  view: ({ state, actor, ctx }) => {
    const hand = actor ? ctx.cards.hand<string>('players', actor.id) : [];
    const deckCounts = Object.fromEntries(
      DECKS.map((deck) => [
        deck,
        ctx.cards.deckCount(deck) + ctx.cards.discardCount(deck),
      ]),
    );
    return playerView({
      game: {
        ...structuredClone(state),
        hand: structuredClone(hand),
        handCounts: ctx.cards.handCounts('players'),
        deckCounts,
      },
      extras: {
        hand: hand.map((cardId) => OLYMPIA_CARD_BY_ID[cardId]),
        handCounts: ctx.cards.handCounts('players'),
        prestige: structuredClone(state.prestige),
        divinity: structuredClone(state.divinity),
        statuses: structuredClone(state.statuses),
        deckCounts,
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
