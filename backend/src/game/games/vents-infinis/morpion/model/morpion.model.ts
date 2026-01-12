export type MorpionMetadata = {
  size: 3;
  board: number[]; // 0 = empty, otherwise playerId
  winnerId?: number | null;
  draw?: boolean;
};

