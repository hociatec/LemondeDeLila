export type CerclesSacresTheme =
  'totem' | 'nature' | 'plante' | 'esprit' | 'parole' | 'nation';

export interface CerclesSacresCircle {
  id: string;
  cards: string[];
  themes: Record<CerclesSacresTheme, string>;
}

export type CerclesSacresState =
  import('../../../engine/sdk/public-api').NoGameState;
