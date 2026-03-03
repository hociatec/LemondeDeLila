export type MorpionMetadata = {
  size: 3;
  board: number[]; // 0 = empty, otherwise playerId
  glyphByPlayerId?: Record<string, string>;
  winnerId?: number | null;
  draw?: boolean;
};
