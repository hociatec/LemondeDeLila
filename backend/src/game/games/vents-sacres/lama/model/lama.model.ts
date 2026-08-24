export type LamaCardValue = 1 | 2 | 3 | 4 | 5 | 6 | 7; // 7 = LAMA

export type LamaRoundStep =
  | 'setup_config'
  | 'turn_choice'
  | 'return_token'
  | 'round_pause';

export type LamaMetadata = {
  rng?: Record<string, unknown>;
  ownerPlayerId: number | null;
  loseAtScore: number | null;
  roundPauseSeconds: number | null;
  allowPlayAfterDraw: boolean;
  startingHandSize: number | null;
  copiesPerCardValue: number | null;
  allowDrawAfterFirstQuit: boolean;
  returnTokenFromRound: number | null;
  roundPauseUntilMs: number | null;
  roundNumber: number;
  roundStarterIndex: number;
  endedRoundNumber?: number | null;
  deck: LamaCardValue[];
  discard: LamaCardValue[];
  handsByPlayerId: Record<string, LamaCardValue[]>;
  droppedOutByPlayerId: Record<string, boolean>;
  scoresByPlayerId: Record<string, number>;
  eliminatedByPlayerId?: Record<string, boolean>;
  step: LamaRoundStep;
  turnTracker?: { playerId: number | null; drawn: boolean; played: boolean };
  /**
   * Anti-boucle: mémorise le dernier `turnIndex` auquel un joueur a pioché.
   * Permet d'empêcher une double pioche même si `turnTracker` devient incohérent.
   */
  lastDrawTurnIndexByPlayerId?: Record<string, number>;
  pendingReturnQueue: number[];
  pendingReturnPlayerId: number | null;
  winnerId?: number | null;
  suppressTurnAnnouncement?: boolean;
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
