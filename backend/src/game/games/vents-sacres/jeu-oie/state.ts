import type { PlayerMap } from '../../../core/application/public-api';

export type GooseTile = {
  id: string;
  label: string;
  description?: string;
  type:
    | 'start'
    | 'goose'
    | 'bridge'
    | 'inn'
    | 'magic-die'
    | 'labyrinth'
    | 'prison'
    | 'death'
    | 'well'
    | 'normal'
    | 'finish';
  turnsToSkip?: number;
  backTo?: number;
};

export type GoosePawn = { id: string; label: string; feminine: boolean };

export type JeuOieState = Record<string, never>;

export type JeuOiePlayerView = {
  inWell: PlayerMap<boolean>;
  pawnByPlayerId: PlayerMap<string>;
};
