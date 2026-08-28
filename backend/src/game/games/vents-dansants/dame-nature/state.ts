export type DameNatureState = Record<string, never>;

export type DameNaturePlayerView = {
  pollutionLoserId: number | null;
  lastQuizCardId: string | null;
};
