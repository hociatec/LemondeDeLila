import {
  cards,
  defineGame,
  playerView,
  standardTurn,
  victoryWhen,
} from '../../../core/application/public-api';
import {
  GERARD_PRESIDENT_NAMES,
  GERARD_PRESIDENT_SPECIAL_CARDS,
  GERARD_PRESIDENT_THEMES,
} from './content';
import { falseByPlayer, GERARD_ACTIONS, zeroByPlayer } from './rules';
import type { GerardPlayerView, GerardState } from './state';

const specialCards = GERARD_PRESIDENT_SPECIAL_CARDS.flatMap((card) => [
  card.id,
  card.id,
]);

export default defineGame<GerardState, typeof GERARD_ACTIONS, GerardPlayerView>(
  {
    id: 'gerard-president',
    displayName: 'Gérard président !',
    category: 'JeuxDePlateaux',
    subcategory: 'VentsDansants',
    description: 'Élisez le prénom le plus absurde face au thème du jury.',
    players: { min: 3, max: 10 },
    components: [
      cards.deck({ id: 'names', cards: GERARD_PRESIDENT_NAMES, shuffle: true }),
      cards.deck({
        id: 'themes',
        cards: GERARD_PRESIDENT_THEMES,
        shuffle: true,
      }),
      cards.deck({ id: 'specials', cards: specialCards, shuffle: true }),
      cards.hands({
        id: 'names',
        deck: 'names',
        initial: 10,
        visibility: 'owner',
      }),
      cards.hands({
        id: 'specials',
        deck: 'specials',
        initial: 2,
        visibility: 'owner',
      }),
    ],
    shortcuts: [
      { key: 'C', type: 'action', actionType: 'play_name' },
      { key: 'S', type: 'action', actionType: 'play_special' },
    ],
    setup: ({ players, ctx }) => ({
      scores: Object.fromEntries(players.map((player) => [player.id, 0])),
      masterId: players[0].id,
      currentTheme: null,
      secondTheme: null,
      lockedName: null,
      winnerId: null,
      roundNumber: 0,
      targetScore: 7,
      submissions: {},
      pendingPlayers: [],
      phase: 'waiting-theme',
      extraNamesAllowed: zeroByPlayer(ctx),
      defenseActive: falseByPlayer(ctx),
      specialAttackers: {},
      themeSecretActive: false,
      juryOverrideId: null,
      ghostNames: [],
    }),
    initialPhase: 'waiting-theme',
    turn: standardTurn(),
    actions: GERARD_ACTIONS,
    victory: victoryWhen(({ state }) =>
      state.winnerId == null
        ? null
        : { winnerPlayerIds: [state.winnerId], reason: 'president-7-points' },
    ),
    view: ({ state, actor, ctx }) => {
      const hand = actor ? ctx.cards.hand<string>('names', actor.id) : [];
      const specialHand = actor
        ? ctx.cards.hand<string>('specials', actor.id)
        : [];
      const isJury =
        actor != null &&
        state.phase === 'choosing-winner' &&
        (state.juryOverrideId ?? state.masterId) === actor.id;
      const submissions = Object.fromEntries(
        Object.entries(state.submissions).map(([playerId, names]) => [
          Number(playerId),
          isJury || Number(playerId) === actor?.id
            ? [...names]
            : names.map(() => 'Prénom secret'),
        ]),
      );
      const { submissions: _submissions, ...publicState } = state;
      const themeHidden =
        state.themeSecretActive && actor?.id !== state.masterId;
      const deckCounts = {
        names: ctx.cards.deckCount('names') + ctx.cards.discardCount('names'),
        themes:
          ctx.cards.deckCount('themes') + ctx.cards.discardCount('themes'),
        specials:
          ctx.cards.deckCount('specials') + ctx.cards.discardCount('specials'),
      };
      return playerView({
        game: {
          ...structuredClone(publicState),
          currentTheme: themeHidden ? 'Thème secret' : state.currentTheme,
          secondTheme: themeHidden ? null : state.secondTheme,
          hand: structuredClone(hand),
          specialHand: structuredClone(specialHand),
          handCounts: ctx.cards.handCounts('names'),
          specialHandCounts: ctx.cards.handCounts('specials'),
          submissions,
          deckCounts,
        },
        extras: {
          hand: structuredClone(hand),
          specialHand: specialHand.map((cardId) =>
            GERARD_PRESIDENT_SPECIAL_CARDS.find((card) => card.id === cardId),
          ),
          submissions,
          scores: structuredClone(state.scores),
        },
      });
    },
    bot: {
      choose: ({ state, actor, ctx }) => {
        if (state.phase === 'waiting-theme')
          return { type: 'set_theme', payload: {} };
        if (state.phase === 'choosing-winner') {
          const winnerId = Number(Object.keys(state.submissions)[0]);
          return { type: 'choose_winner', payload: { winnerId } };
        }
        const name = ctx.cards.hand<string>('names', actor.id)[0];
        return name
          ? { type: 'play_name', payload: { names: [name] } }
          : { type: 'pass', payload: {} };
      },
    },
  },
);
