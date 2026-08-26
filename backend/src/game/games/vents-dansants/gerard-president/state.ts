export type GerardPhase =
  | 'waiting-theme'
  | 'collecting-names'
  | 'choosing-winner';

export interface GerardState {
  scores: Record<number, number>;
  masterId: number;
  currentTheme: string | null;
  secondTheme: string | null;
  lockedName: string | null;
  winnerId: number | null;
  roundNumber: number;
  targetScore: number;
  submissions: Record<number, string[]>;
  pendingPlayers: number[];
  phase: GerardPhase;
  extraNamesAllowed: Record<number, number>;
  defenseActive: Record<number, boolean>;
  specialAttackers: Record<number, number[]>;
  themeSecretActive: boolean;
  juryOverrideId: number | null;
  ghostNames: string[];
}

export type GerardPlayerView = Omit<GerardState, 'submissions'> & {
  hand: string[];
  specialHand: string[];
  handCounts: Record<number, number>;
  specialHandCounts: Record<number, number>;
  submissions: Record<number, string[]>;
  deckCounts: { names: number; themes: number; specials: number };
};
