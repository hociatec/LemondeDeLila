/** Bounded arithmetic over named, read-only capabilities. No arbitrary state paths. */
export type NumericExpression =
  | number
  | { kind: 'resource-value'; resource: string }
  | { kind: 'score-value' }
  | { kind: 'track-value'; trackId: string }
  | { kind: 'inventory-size'; inventoryId: string; itemId?: string }
  | { kind: 'hand-size'; handId: string }
  | { kind: 'player-count'; participants: 'active' | 'all' }
  | {
      kind: 'add' | 'subtract' | 'multiply' | 'divide' | 'min' | 'max';
      left: NumericExpression;
      right: NumericExpression;
    }
  | {
      kind: 'clamp';
      value: NumericExpression;
      min: NumericExpression;
      max: NumericExpression;
    };
