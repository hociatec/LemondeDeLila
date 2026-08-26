export type MorpionState = Record<string, never>;

export type MorpionPlayerView = {
  glyphByPlayerId: Record<string, string>;
  size: 3;
  board: number[];
  startingPlayerId: number;
  winnerId: number | null;
  draw: boolean;
  pawns: ReadonlyArray<{
    id: string;
    label: string;
    description: string;
    glyph: string;
  }>;
};
