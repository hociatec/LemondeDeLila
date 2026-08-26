export interface DameNatureState {
  pollutionTokens: number;
  pollutionLoserId: number | null;
  lastQuizCardId: string | null;
  winnerIds: number[];
}

export type DameNaturePlayerView = DameNatureState & {
  hand: string[];
  handCounts: Record<number, number>;
  deckCount: number;
  discardCount: number;
  completedFamilies: Record<number, number>;
};
