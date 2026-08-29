import { freezeGameContent } from '../../../engine/sdk/public-api';
import type { CorridorPawn } from './types';

export const CORRIDOR_PAWNS: CorridorPawn[] = [
  {
    id: 'vent',
    label: 'Le vent',
    description: 'Rapide et changeant, il traverse le corridor sans hésiter.',
  },
  {
    id: 'eau',
    label: 'L’eau',
    description:
      'Souple et patiente, elle contourne les obstacles avec précision.',
  },
  {
    id: 'terre',
    label: 'La terre',
    description: 'Stable et solide, elle avance avec régularité.',
  },
  {
    id: 'feu',
    label: 'Le feu',
    description: 'Direct et audacieux, il cherche la ligne d’arrivée.',
  },
];

export const CORRIDOR_SIZE = 9;
export const CORRIDOR_DEFAULT_WALLS = 10;

freezeGameContent(CORRIDOR_PAWNS);
