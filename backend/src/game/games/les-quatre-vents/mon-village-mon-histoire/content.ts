import {
  freezeGameContent,
  rejectContent,
} from '../../../engine/sdk/public-api';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { VillageCard, VillageTile } from './types';

type VillageContent = {
  tiles: VillageTile[];
  zones: Array<{ id: number; title: string; cards: VillageCard[] }>;
};

const content = loadContent();

export const VILLAGE_TILES = content.tiles;
export const VILLAGE_ZONES = content.zones;

export const VILLAGE_ZONE_LABELS = Object.fromEntries(
  VILLAGE_ZONES.map((zone) => [zone.id, zone.title]),
);

function loadContent(): VillageContent {
  const directory = contentDirectory();
  const board: unknown = JSON.parse(
    readFileSync(resolve(directory, 'board.json'), 'utf8'),
  );
  const cards: unknown = JSON.parse(
    readFileSync(resolve(directory, 'cards.json'), 'utf8'),
  );
  if (!isBoard(board) || !isCards(cards)) {
    rejectContent('Contenu de Mon Village, Mon Histoire invalide');
  }
  return {
    tiles: board.tiles.map((tile) => ({ ...tile })),
    zones: cards.zones.map((zone) => ({
      id: zone.id,
      title: zone.title,
      cards: zone.cards.map((card) => ({ ...card, zoneId: zone.id })),
    })),
  };
}

function contentDirectory(): string {
  const candidates = [
    resolve(__dirname, 'model/content'),
    resolve(
      process.cwd(),
      'src/game/games/les-quatre-vents/mon-village-mon-histoire/model/content',
    ),
    resolve(
      process.cwd(),
      'dist/game/games/les-quatre-vents/mon-village-mon-histoire/model/content',
    ),
  ];
  const directory = candidates.find((candidate) =>
    existsSync(resolve(candidate, 'board.json')),
  );
  if (!directory) rejectContent('Contenu de Mon Village introuvable');
  return directory;
}

function isBoard(value: unknown): value is { tiles: VillageTile[] } {
  if (!isRecord(value) || !Array.isArray(value.tiles)) return false;
  return value.tiles.length > 0 && value.tiles.every(isTile);
}

function isCards(value: unknown): value is {
  zones: Array<{
    id: number;
    title: string;
    cards: Omit<VillageCard, 'zoneId'>[];
  }>;
} {
  if (!isRecord(value) || !Array.isArray(value.zones)) return false;
  return value.zones.every(
    (zone) =>
      isRecord(zone) &&
      typeof zone.id === 'number' &&
      typeof zone.title === 'string' &&
      Array.isArray(zone.cards) &&
      zone.cards.every(isCard),
  );
}

function isTile(value: unknown): value is VillageTile {
  return (
    isRecord(value) &&
    typeof value.n === 'number' &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    (value.type === 'card' || value.type === 'finish')
  );
}

function isCard(value: unknown): value is Omit<VillageCard, 'zoneId'> {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.title === 'string' &&
    typeof value.description === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

freezeGameContent(content);
freezeGameContent(VILLAGE_ZONE_LABELS);
