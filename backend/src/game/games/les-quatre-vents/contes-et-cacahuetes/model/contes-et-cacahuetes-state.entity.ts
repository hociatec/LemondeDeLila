export type ContesCacahuetesTileType =
  | 'start'
  | 'conte'
  | 'bonus'
  | 'malus'
  | 'surprise'
  | 'finish';

export type ContesCacahuetesTile = {
  type: ContesCacahuetesTileType;
  label: string;
};

export type ContesCardType = 'bonus' | 'malus' | 'surprise' | 'conte';

export type ContesCard = {
  id: number;
  type: ContesCardType;
  title: string;
  text: string;
};

export type ContesCacahuetesMetadata = {
  tiles: ContesCacahuetesTile[];
  positions: Record<number, number>;
  decks: {
    bonus: ContesCard[];
    malus: ContesCard[];
    surprise: ContesCard[];
    contes: ContesCard[];
    discardBonus: ContesCard[];
    discardMalus: ContesCard[];
    discardSurprise: ContesCard[];
    discardContes: ContesCard[];
  };
  statuses: {
    skipTurn: Record<number, number>;
    rerollToken: Record<number, number>;
    shieldMalus: Record<number, number>;
    protectNextMalus: Record<number, boolean>;
    ignoreNextConteAndAdvance: Record<number, boolean>;
    replaceOneOn1By4: Record<number, boolean>;
    noBonusCardsTurns: Record<number, number>;
    forcedRollOneTurns: Record<number, number>;
    reverseNextTurn: Record<number, boolean>;
    blockedUntilPassed: Record<number, number>;
    turnSwapWith: Record<number, number>;
    turnSwapRemaining: Record<number, number>;
    keyOfGold: Record<number, boolean>;
  };
  winnerId: number | null;
};

export type ContesPending =
  | null
  | {
      type: 'reroll';
      label: string;
      playerId: number;
      blocking: true;
      choices: string[];
      data: { baseRoll: number };
    }
  | {
      type: 'choose_target';
      label: string;
      playerId: number;
      blocking: true;
      choices: string[];
      data: {
        context: string;
        targets: Array<{ targetPlayerId: number; targetUsername: string }>;
      };
    }
  | {
      type: 'choose_number';
      label: string;
      playerId: number;
      blocking: true;
      choices: string[];
      data: { context: string; min: number; max: number };
    }
  | {
      type: 'choose_option';
      label: string;
      playerId: number;
      blocking: true;
      choices: string[];
      data: { context: string };
    }
  | {
      type: 'choose_card';
      label: string;
      playerId: number;
      blocking: true;
      choices: string[];
      data: {
        context: string;
        cards: Array<{
          cardType: ContesCardType;
          cardId: number;
          title: string;
        }>;
      };
    }
  | {
      type: 'draw';
      label: string;
      playerId: number;
      blocking: true;
      choices?: string[];
      data: {
        context: string;
        cardType?: ContesCardType;
        queue?: string[];
        remaining?: number;
        drawn?: ContesCard[];
        depth?: number;
      };
    };
