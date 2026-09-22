import type { EffectCard } from '../../../engine/runtime/contracts/effect-card';

export type SharedPrestigeCardsCard = EffectCard<string> & {
  category: string;
  deck: string;
  points?: number;
};
export type SharedPrestigeCardsProgram = {
  mechanics: {
    blockDrawStatus: string;
    blockPlayStatus: string;
    reducedGainStatus: string;
    lossProtectionStatus: string;
    gainDivisor: number;
    categories: readonly {
      category: string;
      blockedBy: readonly string[];
      globallyBlockedBy: readonly string[];
      multiplierStatus?: string;
      bonusStatus?: string;
      penaltyStatus?: string;
    }[];
  };
  handId: string;
  deckIds: readonly string[];
  targetScore: number;
  winnerReason: string;
  cards: readonly SharedPrestigeCardsCard[];
};
