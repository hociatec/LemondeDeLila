import type { PlayerMap } from '../../../core/application/public-api';

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
  extraNamesAllowed: PlayerMap<number>;
  defenseActive: PlayerMap<boolean>;
  themeSecretActive: boolean;
  juryOverrideId: number | null;
  targetScore: number;
  scores: PlayerMap<number>;
  phase: GerardPhase;
  masterId: number;
  pendingPlayers: number[];
  roundNumber: number;
  submissions: PlayerMap<string[]>;
  winnerId: number | null;
};
