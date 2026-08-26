import {
  cards,
  clockwise,
  defineGame,
  playerView,
  victoryWhen,
  when,
} from '../../../core/application/public-api';
import {
  LES_MAINS_CARD_BY_ID,
  LES_MAINS_DECK,
  LES_MAINS_FAMILIES,
} from './content';
import {
  dealProfessionHands,
  LES_MAINS_ACTIONS,
  skipStrikingPlayer,
} from './rules';
import type { LesMainsPlayerView, LesMainsState } from './state';

const deck = cards.deck({
  id: 'professions',
  cards: LES_MAINS_DECK.map((card) => card.id),
  shuffle: true,
});
const hands = cards.hands({
  id: 'players',
  deck: 'professions',
  initial: 0,
  visibility: 'owner',
});

export default defineGame<
  LesMainsState,
  typeof LES_MAINS_ACTIONS,
  LesMainsPlayerView
>({
  id: 'les-mains-de-la-terre',
  displayName: 'Les Mains de la Terre',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: 'Complétez les sept familles de métiers du monde.',
  players: { min: 2, max: 6 },
  components: [deck, hands],
  shortcuts: [{ key: 'D', type: 'action', actionType: 'request_card' }],
  setup: ({ players, ctx }) => {
    dealProfessionHands(
      players.map((player) => player.id),
      ctx,
    );
    return {
      completedFamilies: Object.fromEntries(
        players.map((player) => [player.id, []]),
      ),
      skipTurns: Object.fromEntries(players.map((player) => [player.id, 0])),
      extraDraws: Object.fromEntries(players.map((player) => [player.id, 0])),
      freeFamilyRequest: Object.fromEntries(
        players.map((player) => [player.id, false]),
      ),
      vanishedProfessionUsed: Object.fromEntries(
        players.map((player) => [player.id, false]),
      ),
      gameOver: false,
      winnerIds: [],
    };
  },
  turn: clockwise(),
  actions: LES_MAINS_ACTIONS,
  automatic: [
    when(
      'skip-striking-player',
      ({ state, ctx }) =>
        (state.skipTurns[ctx.players.current()?.id ?? 0] ?? 0) > 0,
      ({ state, ctx }) => skipStrikingPlayer(state, ctx),
    ),
  ],
  victory: victoryWhen(({ state }) =>
    state.gameOver
      ? { winnerPlayerIds: state.winnerIds, reason: 'families-complete' }
      : null,
  ),
  view: ({ state, actor, ctx }) => {
    const hand = actor ? ctx.cards.hand<string>('players', actor.id) : [];
    const handCounts = ctx.cards.handCounts('players');
    return playerView({
      game: {
        ...structuredClone(state),
        hand: structuredClone(hand),
        handCounts,
        deckCount: ctx.cards.deckCount('professions'),
        discardCount: ctx.cards.discardCount('professions'),
      },
      extras: {
        hand: hand.map((cardId) => LES_MAINS_CARD_BY_ID[cardId]),
        handCounts,
        completedFamilies: structuredClone(state.completedFamilies),
        catalog: Object.fromEntries(
          LES_MAINS_FAMILIES.map((family) => [
            family,
            Object.values(LES_MAINS_CARD_BY_ID).filter(
              (card) => card.family === family,
            ),
          ]),
        ),
        freeRequest: actor ? state.freeFamilyRequest[actor.id] : false,
      },
    });
  },
  bot: {
    choose: ({ state, actor, ctx }) => {
      const first = LES_MAINS_ACTIONS.request_card.availableInputs?.({
        state,
        actor,
        ctx,
      })[0];
      return first ? { type: 'request_card', payload: first } : null;
    },
  },
});
