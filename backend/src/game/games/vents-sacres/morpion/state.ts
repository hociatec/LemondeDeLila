export interface MorpionState {
  readonly size: 3;
  board: number[];
  glyphByPlayerId: Record<string, string>;
  startingPlayerId: number;
  winnerId: number | null;
  draw: boolean;
}

export interface MorpionPlayerView extends MorpionState {
  pawns: ReadonlyArray<{
    id: string;
    label: string;
    description: string;
    glyph: string;
  }>;
}
