import manifest from './manifest.json';
import { defineGameContent, gameInput } from '../../../engine/sdk/public-api';
import type { CorridorPawn } from './types';

const defaultPawns: CorridorPawn[] = [
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

export const CORRIDOR_GAME_CONTENT = defineGameContent(
  manifest.code,
  {
    size: 9,
    defaultWallsPerPlayer: 10,
    pawns: defaultPawns,
  },
  {
    schema: gameInput.object({
      size: gameInput.number({ integer: true, min: 3, max: 19 }),
      defaultWallsPerPlayer: gameInput.number({
        integer: true,
        min: 0,
        max: 20,
      }),
      pawns: gameInput.array(
        gameInput.object({
          id: gameInput.string({ min: 1, max: 128 }),
          label: gameInput.string({ min: 1, max: 200 }),
          description: gameInput.string({ max: 10000 }),
        }),
        { min: 2, max: 20 },
      ),
    }),
  },
);
export const CORRIDOR_SIZE = CORRIDOR_GAME_CONTENT.data.size;
export const CORRIDOR_DEFAULT_WALLS =
  CORRIDOR_GAME_CONTENT.data.defaultWallsPerPlayer;
export const CORRIDOR_PAWNS = CORRIDOR_GAME_CONTENT.data.pawns;
