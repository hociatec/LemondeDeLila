import {
  cards,
  cardGame,
  defineGame,
  playerView,
} from '../../../core/application/public-api';
import {
  LES_MAINS_CARD_BY_ID,
  LES_MAINS_DECK,
  LES_MAINS_FAMILIES,
  LES_MAINS_METIER_CARDS,
} from './content';
import {
  dealProfessionHands,
  LES_MAINS_EXTRA_DRAWS,
  LES_MAINS_FREE_REQUEST,
  LES_MAINS_ACTIONS,
  LES_MAINS_EFFECTS,
  LES_MAINS_VANISHED_USED,
} from './rules';
import type { LesMainsPlayerView, LesMainsState } from './state';

const familySets = cards.sets({
  id: 'profession-families',
  hand: 'players',
  deck: 'professions',
  visibility: 'public',
  sets: LES_MAINS_METIER_CARDS.reduce<Record<string, string[]>>(
    (sets, card) => {
      if (card.family) (sets[card.family] ??= []).push(card.id);
      return sets;
    },
    {},
  ),
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
  patterns: [
    cardGame({
      deckId: 'professions',
      handId: 'players',
      cards: LES_MAINS_DECK.map((card) => card.id),
    }),
  ],
  components: [familySets],
  shortcuts: [{ key: 'D', type: 'action', actionType: 'request_card' }],
  setup: ({ players, ctx }) => {
    dealProfessionHands(
      players.map((player) => player.id),
      ctx,
    );
    return {};
  },
  actions: LES_MAINS_ACTIONS,
  effects: LES_MAINS_EFFECTS,
  view: ({ actor, ctx }) => {
    const extraDraws = Object.fromEntries(
      ctx.players
        .all()
        .map((player) => [
          player.id,
          ctx.resources.get(player.id, LES_MAINS_EXTRA_DRAWS),
        ]),
    );
    const statusMap = (statusId: string) =>
      Object.fromEntries(
        ctx.players
          .all()
          .map((player) => [player.id, ctx.status.has(player.id, statusId)]),
      );
    const freeFamilyRequest = statusMap(LES_MAINS_FREE_REQUEST);
    const vanishedProfessionUsed = statusMap(LES_MAINS_VANISHED_USED);
    const skipTurns = Object.fromEntries(
      ctx.players.all().map((player) => [player.id, ctx.turn.skipCount(player.id)]),
    );
    return playerView({
      game: {
        extraDraws,
        freeFamilyRequest,
        vanishedProfessionUsed,
        gameOver: ctx.match.lifecycle() === 'finished',
        winnerIds: ctx.match.result()?.winnerPlayerIds ?? [],
        skipTurns,
      },
      extras: {
        cardCatalog: LES_MAINS_CARD_BY_ID,
        catalog: Object.fromEntries(
          LES_MAINS_FAMILIES.map((family) => [
            family,
            Object.values(LES_MAINS_CARD_BY_ID).filter(
              (card) => card.family === family,
            ),
          ]),
        ),
        freeRequest: actor ? freeFamilyRequest[actor.id] : false,
      },
    });
  },
  bot: {
    choose: ({ state, actor, ctx }) => {
      const first = LES_MAINS_ACTIONS.request_card.enumerate?.({
        state,
        actor,
        ctx,
      })[0];
      return first ? { type: 'request_card', payload: first } : null;
    },
  },
});
