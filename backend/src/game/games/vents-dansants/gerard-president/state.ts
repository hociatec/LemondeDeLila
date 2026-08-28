export type GerardPhase =
  'waiting-theme' | 'collecting-names' | 'choosing-winner';

export interface GerardState {
  currentThemeId: string | null;
  secondThemeId: string | null;
  lockedNameId: string | null;
}

export type GerardPlayerView = {
  currentTheme: string | null;
  secondTheme: string | null;
};
