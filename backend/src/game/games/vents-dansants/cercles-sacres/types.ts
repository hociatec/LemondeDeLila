import type { CerclesSacresTheme } from './content';

export interface CerclesSacresCircle {
  id: string;
  cards: string[];
  themes: Record<CerclesSacresTheme, string>;
}

export type CerclesSacresState =
  import('../../../engine/sdk/public-api').NoGameState;
