import type { GameEffectInstruction } from '../../contracts/effect-ir';

export type CardSelectionOwner = 'actor' | 'next' | 'previous';
export type CardSelectionProgram = {
  choiceId: string;
  /** Chooser relative to the action initiator; source/destination keep that origin. */
  chooser?: CardSelectionOwner;
  source:
    | { kind: 'deck'; deckId: string }
    | { kind: 'discard'; deckId: string }
    | {
        kind: 'hand';
        deckId: string;
        handId: string;
        owner?: CardSelectionOwner;
      };
  destination:
    | { kind: 'discard' }
    | { kind: 'hand'; handId: string; owner?: CardSelectionOwner };
  filter?: {
    includeIds?: readonly (string | number)[];
    excludeIds?: readonly (string | number)[];
    /** All listed content attributes must match exactly. */
    attributes?: Readonly<Record<string, string | number | boolean | null>>;
  };
  min: number;
  max: number;
  shortfall: 'reject' | 'available';
  timeout?: { afterMs: number; strategy: 'first' | 'last' | 'random' };
  effects?: readonly GameEffectInstruction[];
  completeTurn?: boolean;
};
