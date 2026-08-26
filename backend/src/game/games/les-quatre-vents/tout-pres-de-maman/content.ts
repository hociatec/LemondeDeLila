import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { MamanCard, MamanTile } from './state';

export const MAMAN_CONTENT = loadContent();

function loadContent(): { tiles: MamanTile[]; cards: MamanCard[] } {
  const directory = contentDirectory();
  const board: unknown = JSON.parse(
    readFileSync(resolve(directory, 'board.json'), 'utf8'),
  );
  const cards: unknown = JSON.parse(
    readFileSync(resolve(directory, 'cards.json'), 'utf8'),
  );
  if (
    !isRecord(board) ||
    !Array.isArray(board.tiles) ||
    !board.tiles.every(isTile) ||
    !isRecord(cards) ||
    !Array.isArray(cards.cards) ||
    !cards.cards.every(isCard)
  ) {
    throw new Error('Contenu de Tout près de Maman invalide');
  }
  return { tiles: board.tiles, cards: cards.cards };
}

function contentDirectory(): string {
  const candidates = [
    resolve(__dirname, 'model/content'),
    resolve(
      process.cwd(),
      'src/game/games/les-quatre-vents/tout-pres-de-maman/model/content',
    ),
    resolve(
      process.cwd(),
      'dist/game/games/les-quatre-vents/tout-pres-de-maman/model/content',
    ),
  ];
  const found = candidates.find((directory) =>
    existsSync(resolve(directory, 'board.json')),
  );
  if (!found) throw new Error('Contenu de Tout près de Maman introuvable');
  return found;
}

function isTile(value: unknown): value is MamanTile {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.title === 'string' &&
    typeof value.type === 'string'
  );
}

function isCard(value: unknown): value is MamanCard {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.text === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
