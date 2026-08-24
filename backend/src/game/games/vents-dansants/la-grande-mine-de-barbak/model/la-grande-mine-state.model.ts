export interface LaGrandeMineDomain {
  treasures: string[];
  objects: string[];
}

export interface LaGrandeMineMetadata {
  rng?: Record<string, unknown>;
  deck: string[];
  discard: string[];
  hands: Record<number, string[]>;
  drawnPlayerId: number | null;
  domains: Record<number, LaGrandeMineDomain>;
  winnerId?: number | null;
  collapseTriggered?: boolean;
}
