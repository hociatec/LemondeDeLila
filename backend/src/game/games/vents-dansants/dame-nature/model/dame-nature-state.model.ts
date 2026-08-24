export interface DameNatureFamilyProgress {
  [familyId: string]: string[];
}

export interface DameNatureMetadata {
  rng?: Record<string, unknown>;
  deck: string[];
  discard: string[];
  hands: Record<number, string[]>;
  families: Record<number, DameNatureFamilyProgress>;
  pollutionTokens: number;
  pollutionLoserId?: number | null;
  winnerId?: number | null;
  lastQuizCardId?: string | null;
}
