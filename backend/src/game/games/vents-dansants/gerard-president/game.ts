import {
  cards,
  cardGame,
  defineCardsSchema,
  defineGame,
  defineGameContent,
} from '../../../engine/sdk/public-api';
import {
  GERARD_PRESIDENT_NAME_CARDS,
  GERARD_PRESIDENT_SPECIAL_CARDS,
  GERARD_PRESIDENT_THEME_BY_ID,
  GERARD_PRESIDENT_THEME_CARDS,
  type GerardPresidentNameCard,
} from './content';
import { GERARD_ACTIONS } from './rules';
import { GERARD_EFFECTS } from './effects';
import {
  GERARD_JUDGE,
  GERARD_PHASES,
  GERARD_SUBMISSIONS,
  GERARD_THEME_SECRET,
  gerardMasterId,
} from './support';
import type { GerardState } from './state';

type GerardPlayerView = {
  currentTheme: string | null;
  secondTheme: string | null;
};

const themeCards = defineCardsSchema({
  decks: {
    themes: cards.deck({
      id: 'themes',
      cards: GERARD_PRESIDENT_THEME_CARDS,
      shuffle: true,
    }),
  },
  hands: {},
});

const specialCards = GERARD_PRESIDENT_SPECIAL_CARDS.flatMap((card) => [
  card.id,
  card.id,
]);

export default defineGame<GerardState>()({
  id: 'gerard-president',
  displayName: 'Gérard président !',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: 'Élisez le prénom le plus absurde face au thème du jury.',
  players: { min: 3, max: 10 },
  content: defineGameContent('gerard-president', {
    names: GERARD_PRESIDENT_NAME_CARDS,
    themes: GERARD_PRESIDENT_THEME_CARDS,
    specialCards: GERARD_PRESIDENT_SPECIAL_CARDS,
  }),
  patterns: [
    cardGame({
      deckId: 'names',
      handId: 'names',
      cards: GERARD_PRESIDENT_NAME_CARDS,
      initialHandSize: 10,
    }),
    cardGame({
      deckId: 'specials',
      handId: 'specials',
      cards: specialCards,
      initialHandSize: 2,
    }),
  ],
  components: [...themeCards.components],
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'play_name' },
    { key: 'S', type: 'action', actionType: 'play_special' },
  ],
  setup: ({ players, ctx }) => {
    ctx.submissionFlow.startJudge(GERARD_JUDGE, {
      players: players.map((player) => player.id),
    });
    return {
      currentThemeId: null,
      secondThemeId: null,
      lockedNameId: null,
    };
  },
  initialPhase: GERARD_PHASES.initialPhase,
  phases: GERARD_PHASES.phases,
  actions: GERARD_ACTIONS,
  effects: GERARD_EFFECTS,
  viewExtension: ({ state, actor, ctx }): GerardPlayerView => {
    const masterId = gerardMasterId(ctx);
    const themeSecretActive = ctx.counters.get(GERARD_THEME_SECRET) > 0;
    const themeHidden = themeSecretActive && actor?.id !== masterId;
    return {
      currentTheme: themeHidden
        ? 'Thème secret'
        : state.currentThemeId == null
          ? null
          : (GERARD_PRESIDENT_THEME_BY_ID[state.currentThemeId]?.text ?? null),
      secondTheme: themeHidden
        ? null
        : state.secondThemeId == null
          ? null
          : (GERARD_PRESIDENT_THEME_BY_ID[state.secondThemeId]?.text ?? null),
    };
  },
  bot: {
    choose: ({ state: _state, actor, ctx }) => {
      if (GERARD_PHASES.is(ctx, 'waiting-theme'))
        return { type: 'set_theme', payload: {} };
      if (GERARD_PHASES.is(ctx, 'choosing-winner')) {
        const winnerId = Number(
          Object.entries(
            ctx.submissions.values<string[]>(GERARD_SUBMISSIONS),
          ).find(([, names]) => names.length > 0)?.[0],
        );
        return { type: 'choose_winner', payload: { winnerId } };
      }
      const name = ctx.cards.hand<GerardPresidentNameCard>('names', actor.id)[0]
        ?.id;
      return name
        ? { type: 'play_name', payload: { names: [name] } }
        : { type: 'pass', payload: {} };
    },
  },
});
