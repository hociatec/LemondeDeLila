import { freezeGameContent } from '../../../engine/sdk/public-api';

export const ODYSSEE_CONTENT = {
  trackLength: 56,
  homeLength: 6,
  pawnsPerPlayer: 4,
  pawnNames: ['Aube', 'Brise', 'Comète', 'Dune'],
} as const;

freezeGameContent(ODYSSEE_CONTENT);
