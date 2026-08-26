export type VoyageTileType =
  | 'start'
  | 'finish'
  | 'neutral'
  | 'rest'
  | 'passage'
  | 'legend'
  | 'farce'
  | 'treasure'
  | 'landscape';

export interface VoyageTile {
  id: number;
  title: string;
  type: VoyageTileType;
  label?: string;
  description?: string;
}

export interface VoyageCard {
  id: number;
  title: string;
  description: string;
  effect: string;
}

export type VoyageCollectionKind =
  | 'legend'
  | 'farce'
  | 'treasure'
  | 'landscape';

export type VoyageCollection = Record<VoyageCollectionKind, number>;

export type VoyagePendingChoice =
  | {
      kind: 'quiz';
      actorId: number;
      card: VoyageCard;
      answer: string;
      successDelta: number;
    }
  | {
      kind: 'target';
      actorId: number;
      effect: 'swap-position' | 'skip-turn' | 'swap-card';
      count: number;
    };

export interface VoyageState {
  collections: Record<number, VoyageCollection>;
  skipTurns: Record<number, number>;
  lastTargetByActor: Record<number, number>;
  lastRoll: number | null;
  finishCountdown: number | null;
  winnerId: number | null;
  pendingChoice: VoyagePendingChoice | null;
}

export type VoyagePlayerView = Omit<VoyageState, 'pendingChoice'> & {
  positions: Record<number, number>;
  deckCounts: Record<VoyageCollectionKind, number>;
};
