import {
  freezeGameContent,
  rejectContent,
} from '../../../core/application/public-api';
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
  if (!path) rejectContent('Plateau Primalis introuvable');
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (
    !isRecord(parsed) ||
    !Array.isArray(parsed.tiles) ||
    parsed.tiles.length === 0 ||
    !parsed.tiles.every(isPrimalisTile)
  ) {
    rejectContent('Plateau Primalis invalide');
  }
  return parsed.tiles;
}

function isPrimalisTile(value: unknown): value is PrimalisTile {
  return (
    isRecord(value) &&
    typeof value.n === 'number' &&
    Number.isSafeInteger(value.n) &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    value.type === 'comet'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

freezeGameContent(PRIMALIS_TILES);
