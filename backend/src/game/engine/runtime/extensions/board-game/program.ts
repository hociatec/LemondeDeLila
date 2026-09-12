/** Single-consumer JSON authoring extension; prefer shared effects and patterns for new rules. */
/** Closed data instructions for a turn that resolves successive board landings. */
export type BoardLanding =
  | { kind: 'move'; distance: number }
  | { kind: 'random-move'; minimum: number; maximum: number; direction: 1 | -1 }
  | { kind: 'choose-direction'; distance: number }
  | { kind: 'skip'; turns: number }
  | { kind: 'draw'; deckId: string }
  | { kind: 'collect'; sourceId?: string }
  | { kind: 'quiz' }
  | { kind: 'nearest'; tag: string }
  | { kind: 'finish'; reason: string }
  | { kind: 'finish-collection'; minimumScore: number; reason: string };

export type BoardTile = {
  id: string;
  label: string;
  description: string;
  tags?: readonly string[];
  operations: readonly BoardLanding[];
};

export type BoardGameProgram = {
  namespace: string;
  trackId: string;
  diceId: string;
  playingPhase: string;
  startingPlayer: 'first' | 'random';
  maxDepth: number;
  tiles: readonly BoardTile[];
  scorePerForwardLap?: number;
  restoreDirection?: { status: string; ruleId: string };
  pawnSelection?: {
    setId: string;
    choiceId: string;
    announceInventory?: { inventoryId: string; eventType: string };
  };
  distribution?: {
    inventoryId: string;
    groups: readonly (readonly string[])[];
  };
  collection?: {
    requiredInventoryId: string;
    collectedInventoryId: string;
    overflowInventoryId: string;
    sources: Readonly<Record<string, readonly string[]>>;
    defaultSourceId: string;
    collectedMessage: string;
    overflowMessage: string;
  };
  quiz?: { bankId: string; choiceId: string; correctMove: number };
  exchange?: {
    inventoryId: string;
    takeChoiceId: string;
    giveChoiceId: string;
  };
  directionChoiceId?: string;
  bindings: Readonly<
    Record<
      string,
      | { kind: 'move' }
      | { kind: 'collect' }
      | { kind: 'quiz' }
      | { kind: 'nearest'; tag: string }
      | { kind: 'exchange' }
    >
  >;
};
