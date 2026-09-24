import type { GameEffectInstruction } from '../../../engine/sdk/extension-contracts';

export type PawScoringObstacle = string;
export type PawScoringParade = string;
export type PawScoringPower = string;

type CardBase = {
  id: string;
  name: string;
  description?: string;
  effect?: string;
  effects: readonly GameEffectInstruction[];
};
export type PawScoringCard = CardBase &
  (
    | { type: 'pattes'; value: number }
    | { type: 'obstacle'; obstacle: PawScoringObstacle }
    | { type: 'parade'; parade: PawScoringParade }
    | { type: 'bot'; bot: PawScoringPower }
  );

export type PawScoringProgram = {
  deckId: string;
  handId: string;
  trackId: string;
  goal: number;
  initialHandSize: number;
  defaultRounds: number;
  statusPrefix: string;
  mechanics: {
    statuses: {
      obstacle: string;
      power: string;
      activated: string;
      activationUsed: string;
      obstacleLock: string;
    };
    activationCounter: string;
    counters: readonly string[];
    obstacles: readonly {
      id: string;
      counter: string;
      blocks: boolean;
      maximumMove?: number;
    }[];
    powers: readonly {
      id: string;
      ignores: readonly string[];
      disablesCounters: readonly string[];
      bypassesActivation: boolean;
    }[];
    moveLimits: readonly { value: number; uses: number; resource: string }[];
    finishReason: string;
  };
  cards: readonly PawScoringCard[];
};
