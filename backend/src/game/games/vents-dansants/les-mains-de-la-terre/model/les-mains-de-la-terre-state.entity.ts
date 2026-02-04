import type { LesMainsFamily } from './les-mains-de-la-terre-cards';

export interface LesMainsMetadata {
  rng?: Record<string, any>;
  deck: string[];
  discard: string[];
  hands: Record<number, string[]>;
  completedFamilies: Record<number, LesMainsFamily[]>;
  statuses?: {
    skipTurn?: Record<number, number>;
  };
  extraDraws?: Record<number, number>;
  freeFamilyRequest?: Record<number, boolean>;
  bonusMetierDisparuUsed?: Record<number, boolean>;
  winnerId?: number | null;
}
