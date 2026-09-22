import type { CardSelectionProgram } from '../contracts/card-selection-contract';
import type { GameEffectInstruction } from '../contracts/effect-ir';
import type { JsonStandardVictory } from './json-standard-victory';

export type JsonGameRecipe = string;

export type JsonGameAction = (
  | { effects: readonly GameEffectInstruction[] }
  | { selectCards: CardSelectionProgram }
  | { recipe: JsonGameRecipe }
) & { documentation?: string };

export type JsonGameVictory = JsonStandardVictory | { kind: `by-${string}` };
