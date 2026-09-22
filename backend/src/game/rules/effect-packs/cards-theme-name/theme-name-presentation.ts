import type { ThemeNameCardsProgram, ThemeNameCardsNameCard } from './program';
import {
  THEME_NAME,
  themeNameCardsState,
  type ThemeNameCardsState,
  type ThemeNameCardsContext,
  type ThemeNameCardsPhases,
  type createThemeNameCardsSupport,
} from './theme-name-support';
export function themeNamePresentation(
  program: ThemeNameCardsProgram,
  phases: ThemeNameCardsPhases,
  support: ReturnType<typeof createThemeNameCardsSupport>,
) {
  return {
    viewExtension: ({
      state,
      actor,
      ctx,
    }: {
      state: ThemeNameCardsState;
      actor: { id: number } | null;
      ctx: ThemeNameCardsContext;
    }) => {
      const hidden =
        ctx.counters.get(THEME_NAME.themeSecret) > 0 &&
        actor?.id !== support.masterId(ctx);
      const current = themeNameCardsState(state, 'currentThemeId');
      const second = themeNameCardsState(state, 'secondThemeId');
      return {
        currentTheme: hidden
          ? 'Thème secret'
          : (program.themes.find((theme) => theme.id === current)?.text ??
            null),
        secondTheme: hidden
          ? null
          : (program.themes.find((theme) => theme.id === second)?.text ?? null),
      };
    },
    chooseBot(actorId: number, ctx: Parameters<typeof support.masterId>[0]) {
      if (phases.is(ctx, 'waiting-theme'))
        return { recipe: 'cards-theme-name-set-theme' as const, payload: {} };
      if (phases.is(ctx, 'choosing-winner')) {
        const candidates = Object.entries(
          ctx.submissions.values<string[]>(THEME_NAME.submissions),
        )
          .filter(([, names]) => names.length > 0)
          .map(([id]) => Number(id));
        const winnerId = ctx.ranking.rank(candidates)[0]?.playerId;
        return winnerId == null
          ? null
          : {
              recipe: 'cards-theme-name-choose-winner' as const,
              payload: { winnerId },
            };
      }
      const name = ctx.cards.hand<ThemeNameCardsNameCard>(
        THEME_NAME.names,
        actorId,
      )[0]?.id;
      return name
        ? {
            recipe: 'cards-theme-name-play-name' as const,
            payload: { names: [name] },
          }
        : { recipe: 'cards-theme-name-pass' as const, payload: {} };
    },
  };
}
