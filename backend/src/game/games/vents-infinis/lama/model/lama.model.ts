export type LamaCardValue = 1 | 2 | 3 | 4 | 5 | 6 | 7; // 7 = LAMA

export type LamaRoundStep = 'setup_target' | 'turn_choice' | 'return_token';

export type LamaMetadata = {
  rng?: Record<string, any>;
  ownerPlayerId: number | null;
  loseAtScore: number | null;
  roundNumber: number;
  roundStarterIndex: number;
  deck: LamaCardValue[];
  discard: LamaCardValue[];
  handsByPlayerId: Record<string, LamaCardValue[]>;
  droppedOutByPlayerId: Record<string, boolean>;
  scoresByPlayerId: Record<string, number>;
  step: LamaRoundStep;
  pendingReturnQueue: number[];
  pendingReturnPlayerId: number | null;
  winnerId?: number | null;
};

export const LAMA_VALUE: LamaCardValue = 7;

export const lamaCardLabel = (v: LamaCardValue): string =>
  v === LAMA_VALUE ? 'LAMA' : String(v);

export const lamaCardScore = (v: LamaCardValue): number =>
  v === LAMA_VALUE ? 10 : v;

export const nextLamaValue = (top: LamaCardValue): LamaCardValue => {
  if (top === 6) return LAMA_VALUE;
  if (top === LAMA_VALUE) return 1;
  return (top + 1) as LamaCardValue;
};
