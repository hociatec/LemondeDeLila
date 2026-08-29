import {
  freezeGameContent,
  rejectContent,
} from '../../../engine/sdk/public-api';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FouleesFamily } from './types';

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

export const FOULEES_PAWNS = FOULEES_FAMILIES.flatMap((family) =>
  family.pawns.map((label, pawnIndex) => ({
    id: `${family.id}:${pawnIndex}`,
    label,
  })),
);

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
    !isArrayOf(raw.tiles, isTile) ||
    raw.tiles.length !== raw.trackLength ||
    !isArrayOf(raw.safeTiles, isInteger)
  ) {
    rejectContent('Plateau Foulées Fantastiques invalide');
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
  if (!found) rejectContent('Contenu Foulées Fantastiques introuvable');
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

function isArrayOf<T>(
  value: unknown,
  guard: (item: unknown) => item is T,
): value is T[] {
  return Array.isArray(value) && value.every(guard);
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

freezeGameContent(FOULEES_FAMILIES);
freezeGameContent(FOULEES_PAWNS);
freezeGameContent(FOULEES_BOARD);
