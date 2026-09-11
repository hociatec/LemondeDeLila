export type DiceDefinition = {
  readonly component: 'dice.set';
  readonly id: string;
  readonly count: number;
  readonly sides: number;
};

export type DiceRollResult = { values: number[]; total: number };

export type DiceRollPolicy = {
  extraDice?: number;
  attempts?: number;
  select?: 'first' | 'last' | 'best' | 'worst';
  keep?: 'all' | 'highest' | 'lowest';
  modifier?: number;
  multiplier?: number;
  reroll?: {
    while(result: Readonly<DiceRollResult>): boolean;
    max?: number;
  };
};

export type PersistedDiceRoll = DiceRollResult & {
  policy?: Pick<
    DiceRollPolicy,
    'extraDice' | 'keep' | 'multiplier' | 'modifier'
  >;
};
