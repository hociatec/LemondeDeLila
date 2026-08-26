import {
  cards,
  cardGame,
  defineGame,
  playerView,
} from '../../../core/application/public-api';
import {
  GERARD_PRESIDENT_NAME_BY_ID,
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
  GERARD_TARGET_SCORE,
  GERARD_THEME_SECRET,
  gerardDefenses,
  gerardExtraNames,
  gerardJuryOverride,
  gerardMasterId,
} from './support';
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
    components: [
      cards.deck({
        id: 'themes',
        cards: GERARD_PRESIDENT_THEME_CARDS,
        shuffle: true,
      }),
    ],
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
    view: ({ state, actor, ctx }) => {
      const masterId = gerardMasterId(ctx);
      const juryOverrideId = gerardJuryOverride(ctx);
      const isJury =
        actor != null &&
        GERARD_PHASES.is(ctx, 'choosing-winner') &&
        (juryOverrideId ?? masterId) === actor.id;
      const storedSubmissions = ctx.submissions.has(GERARD_SUBMISSIONS)
        ? ctx.submissions.values<string[]>(GERARD_SUBMISSIONS)
        : {};
      const submissions = Object.fromEntries(
        Object.entries(storedSubmissions).map(([playerId, cardIds]) => [
          Number(playerId),
          isJury || Number(playerId) === actor?.id
            ? cardIds.map(
                (cardId) => GERARD_PRESIDENT_NAME_BY_ID[cardId]?.name ?? cardId,
              )
            : cardIds.map(() => 'Prénom secret'),
        ]),
      );
      const themeSecretActive = ctx.counters.get(GERARD_THEME_SECRET) > 0;
      const themeHidden = themeSecretActive && actor?.id !== masterId;
      return playerView({
        game: {
          extraNamesAllowed: gerardExtraNames(ctx),
          defenseActive: gerardDefenses(ctx),
          themeSecretActive,
          juryOverrideId,
          targetScore: GERARD_TARGET_SCORE,
          phase: GERARD_PHASES.current(ctx),
          masterId,
          pendingPlayers: ctx.submissions.has(GERARD_SUBMISSIONS)
            ? ctx.submissions.pendingPlayers(GERARD_SUBMISSIONS)
            : [],
          currentTheme: themeHidden
            ? 'Thème secret'
            : state.currentThemeId == null
              ? null
              : (GERARD_PRESIDENT_THEME_BY_ID[state.currentThemeId]?.text ??
                null),
          secondTheme: themeHidden
            ? null
            : state.secondThemeId == null
              ? null
              : (GERARD_PRESIDENT_THEME_BY_ID[state.secondThemeId]?.text ??
                null),
          submissions,
        },
        extras: {
          specialCardCatalog: GERARD_PRESIDENT_SPECIAL_CARDS,
          submissions,
        },
      });
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
        const name = ctx.cards.hand<GerardPresidentNameCard>(
          'names',
          actor.id,
        )[0]?.id;
        return name
          ? { type: 'play_name', payload: { names: [name] } }
          : { type: 'pass', payload: {} };
      },
    },
  },
);
