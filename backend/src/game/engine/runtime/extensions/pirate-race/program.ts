/** Single-consumer JSON authoring extension; prefer shared effects and patterns for new rules. */
import type { GameEffectInstruction } from '../../contracts/effect-ir';

export type PirateDeckKind = 'treasure' | 'obstacle' | 'bonus';

export type PirateRaceProgram = {
  trackId: string;
  diceId: string;
  tiles: readonly {
    n: number;
    title: string;
    description: string;
    type:
      | 'start'
      | 'neutral'
      | 'bonus'
      | 'treasure'
      | 'obstacle'
      | 'gold'
      | 'finish';
  }[];
  decks: Record<PirateDeckKind, string>;
  inventories: Record<PirateDeckKind, string>;
  goldResource: string;
  obstacleImmunityStatus: string;
  collectionLimit: number;
  requiredTreasures: number;
  requiredGold: number;
  retreatSpaces: number;
  finishReason: string;
  stealEffectId: string;
  eventNamespace: string;
};
export type PirateRaceCard = {
  id: string | number;
  effects: readonly GameEffectInstruction[];
};
