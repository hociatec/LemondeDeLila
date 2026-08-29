export type MinuitTileType =
  'start' | 'neutral' | 'card' | 'move' | 'skip' | 'finish';

export type MinuitTile = {
  n: number;
  title: string;
  type: MinuitTileType;
  delta: number;
  skipTurns: number;
};

const CARD_TILES = new Set([
  2, 6, 10, 13, 16, 21, 24, 28, 31, 35, 38, 41, 45, 48, 51,
]);
const SKIP_TILES = new Set([7, 12, 25, 39, 49]);
const MOVE_BY_TILE: Record<number, number> = {
  3: 3,
  5: -1,
  18: -3,
  19: 2,
  26: 1,
  29: -1,
  32: -2,
  36: 2,
  44: -1,
  47: 1,
};

export const MINUIT_TILES: MinuitTile[] = Array.from(
  { length: 56 },
  (_entry, index) => {
    const type: MinuitTileType =
      index === 0
        ? 'start'
        : index === 55
          ? 'finish'
          : CARD_TILES.has(index)
            ? 'card'
            : SKIP_TILES.has(index)
              ? 'skip'
              : MOVE_BY_TILE[index] != null
                ? 'move'
                : 'neutral';
    return {
      n: index + 1,
      title:
        type === 'start'
          ? 'Village du Père Noël'
          : type === 'finish'
            ? 'La Grande Fête de Noël'
            : type === 'card'
              ? 'Carte Noël'
              : type === 'skip'
                ? 'Obstacle de Noël'
                : type === 'move'
                  ? 'Événement de Noël'
                  : 'Chemin enneigé',
      type,
      delta: MOVE_BY_TILE[index] ?? 0,
      skipTurns: type === 'skip' ? 1 : 0,
    };
  },
);
