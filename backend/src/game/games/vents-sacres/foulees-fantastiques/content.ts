import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FouleesFamily } from './state';

type Board = {
  trackLength: number;
  homeLength: number;
  tiles: Array<{ id: string; label: string }>;
  safeTiles: number[];
};

export const FOULEES_FAMILIES: readonly FouleesFamily[] = [
  {
    id: 'equides',
    family: 'Equidés',
    habitat: 'écurie',
    pawns: ['Akhal-teke', 'Andalou', 'Frison', 'Pur-sang'],
  },
  {
    id: 'primates',
    family: 'Primates',
    habitat: 'primaterie',
    pawns: ['Douc', 'Gibbon', 'Mandrill', 'Sakis'],
  },
  {
    id: 'oiseaux',
    family: 'Oiseaux',
    habitat: 'volière',
    pawns: ['Cygne', 'Héron', 'Paon', 'Perroquet'],
  },
  {
    id: 'poissons',
    family: 'Poissons',
    habitat: 'aquarium',
    pawns: ['Anthias', 'Discus', 'Mandarin', 'Mérou'],
  },
];

export const FOULEES_BOARD = loadBoard();

function loadBoard(): Board {
  const directory = contentDirectory();
  const raw: unknown = JSON.parse(
    readFileSync(resolve(directory, 'board.json'), 'utf8').replace(
      /^\uFEFF/,
      '',
    ),
  );
  if (
    !isRecord(raw) ||
    raw.version !== 1 ||
    !Number.isInteger(raw.trackLength) ||
    Number(raw.trackLength) < 1 ||
    !Number.isInteger(raw.homeLength) ||
    Number(raw.homeLength) < 1 ||
    !Array.isArray(raw.tiles) ||
    raw.tiles.length !== raw.trackLength ||
    !raw.tiles.every(isTile) ||
    !Array.isArray(raw.safeTiles) ||
    !raw.safeTiles.every((value) => Number.isInteger(value))
  ) {
    throw new Error('Plateau Foulées Fantastiques invalide');
  }
  return {
    trackLength: Number(raw.trackLength),
    homeLength: Number(raw.homeLength),
    tiles: raw.tiles.map((tile, index) => ({
      id: tile.id ?? `c${index}`,
      label: tile.label ?? (index === 0 ? 'Départ' : `Case ${index + 1}`),
    })),
    safeTiles: raw.safeTiles,
  };
}

function contentDirectory(): string {
  const candidates = [
    resolve(__dirname, 'model/content'),
    resolve(
      process.cwd(),
      'src/game/games/vents-sacres/foulees-fantastiques/model/content',
    ),
    resolve(
      process.cwd(),
      'dist/game/games/vents-sacres/foulees-fantastiques/model/content',
    ),
  ];
  const found = candidates.find((directory) =>
    existsSync(resolve(directory, 'board.json')),
  );
  if (!found) throw new Error('Contenu Foulées Fantastiques introuvable');
  return found;
}

function isTile(value: unknown): value is { id?: string; label?: string } {
  return (
    isRecord(value) &&
    (value.id == null || typeof value.id === 'string') &&
    (value.label == null || typeof value.label === 'string')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
