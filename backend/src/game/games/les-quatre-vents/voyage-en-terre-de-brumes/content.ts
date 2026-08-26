import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { VoyageCard, VoyageTile, VoyageTileType } from './state';

type VoyageContent = {
  tiles: VoyageTile[];
  legend: VoyageCard[];
  farce: VoyageCard[];
  treasure: VoyageCard[];
  landscape: VoyageCard[];
};

export const VOYAGE_CONTENT = loadContent();

function loadContent(): VoyageContent {
  const directory = contentDirectory();
  return {
    tiles: readArray(directory, 'board.json', 'tiles', isTile),
    legend: readArray(directory, 'legend-cards.json', 'cards', isCard),
    farce: readArray(directory, 'farce-cards.json', 'cards', isCard),
    treasure: readArray(directory, 'treasure-cards.json', 'cards', isCard),
    landscape: readArray(directory, 'landscape-cards.json', 'cards', isCard),
  };
}

function readArray<T>(
  directory: string,
  filename: string,
  field: string,
  guard: (value: unknown) => value is T,
): T[] {
  const raw: unknown = JSON.parse(
    readFileSync(resolve(directory, filename), 'utf8').replace(/^\uFEFF/, ''),
  );
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw[field])) {
    throw new Error(`Contenu Voyage invalide: ${filename}`);
  }
  const values = raw[field];
  if (values.length === 0 || !values.every(guard)) {
    throw new Error(`Entrées Voyage invalides: ${filename}`);
  }
  return values;
}

function contentDirectory(): string {
  const candidates = [
    resolve(__dirname, 'model/content'),
    resolve(
      process.cwd(),
      'src/game/games/les-quatre-vents/voyage-en-terre-de-brumes/model/content',
    ),
    resolve(
      process.cwd(),
      'dist/game/games/les-quatre-vents/voyage-en-terre-de-brumes/model/content',
    ),
  ];
  const found = candidates.find((directory) =>
    existsSync(resolve(directory, 'board.json')),
  );
  if (!found) throw new Error('Contenu Voyage en Terre de Brumes introuvable');
  return found;
}

function isTile(value: unknown): value is VoyageTile {
  if (!isRecord(value)) return false;
  const types: VoyageTileType[] = [
    'start',
    'finish',
    'neutral',
    'rest',
    'passage',
    'legend',
    'farce',
    'treasure',
    'landscape',
  ];
  return (
    typeof value.id === 'number' &&
    typeof value.title === 'string' &&
    types.includes(value.type as VoyageTileType) &&
    (value.label == null || typeof value.label === 'string') &&
    (value.description == null || typeof value.description === 'string')
  );
}

function isCard(value: unknown): value is VoyageCard {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    typeof value.effect === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
