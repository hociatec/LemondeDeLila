export type DameNatureState = Record<string, never>;

export type DameNaturePlayerView = {
  pollutionTokens: number;
  pollutionLoserId: number | null;
  lastQuizCardId: string | null;
};
