export type GaloponsTargetKind = 'give-apple' | 'help-advance' | 'pair-advance';

export interface GaloponsState {
  pawnByPlayerId: Record<number, string>;
  setupComplete: boolean;
  starterId: number;
  apples: Record<number, number>;
  movementDirection: Record<number, 1 | -1>;
  ious: Record<number, Record<number, number>>;
  skipTurns: Record<number, number>;
  replay: boolean;
  targetKind: GaloponsTargetKind | null;
  targetActorId: number | null;
  winnerId: number | null;
}

export type GaloponsPlayerView = GaloponsState & {
  positions: Record<number, number>;
  deckCount: number;
};
