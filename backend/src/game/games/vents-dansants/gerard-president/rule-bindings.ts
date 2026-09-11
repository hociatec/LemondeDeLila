import type { GameRuleBindings } from '../../../engine/sdk/public-api';
import { GERARD_PRESIDENT_THEME_BY_ID } from './content';
import type { GerardState } from './state';
import { GERARD_THEME_SECRET } from './game-constants';
import { gerardMasterId } from './round-rules';
export type GerardPlayerView = {
  currentTheme: string | null;
  secondTheme: string | null;
};
export const GAME_RULES = {
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
} satisfies GameRuleBindings<GerardState, GerardPlayerView>;
