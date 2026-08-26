import type { CerclesSacresTheme } from './content';
import type { PlayerMap } from '../../../core/application/public-api';

export interface CerclesSacresCircle {
  id: string;
  cards: string[];
  themes: Record<CerclesSacresTheme, string>;
}

export type CerclesSacresState = Record<string, never>;

export type CerclesSacresPlayerView = {
  circles: PlayerMap<CerclesSacresCircle[]>;
};
