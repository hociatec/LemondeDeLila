import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type PrimalisTile = {
  n: number;
  title: string;
  description: string;
  type: 'comet';
};

export const PRIMALIS_TILES = loadTiles();

function loadTiles(): PrimalisTile[] {
  const candidates = [
    resolve(__dirname, 'model/content/board.json'),
    resolve(
      process.cwd(),
      'src/game/games/les-quatre-vents/primalis/model/content/board.json',
    ),
    resolve(
      process.cwd(),
      'dist/game/games/les-quatre-vents/primalis/model/content/board.json',
    ),
  ];
  const path = candidates.find(existsSync);
  if (!path) throw new Error('Plateau Primalis introuvable');
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
    tiles?: PrimalisTile[];
  };
  if (!Array.isArray(parsed.tiles) || parsed.tiles.length === 0) {
    throw new Error('Plateau Primalis invalide');
  }
  return parsed.tiles;
}
