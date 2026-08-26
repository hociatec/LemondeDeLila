import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PirateCard, PirateTile } from './state';

type PirateContent = {
  tiles: PirateTile[];
  treasure: PirateCard[];
  obstacle: PirateCard[];
  bonus: PirateCard[];
};

export const PIRATES_CONTENT = loadContent();

function loadContent(): PirateContent {
  const directory = contentDirectory();
  const board: unknown = JSON.parse(
    readFileSync(resolve(directory, 'board.json'), 'utf8'),
  );
  const cards: unknown = JSON.parse(
    readFileSync(resolve(directory, 'cards.json'), 'utf8'),
  );
  if (!isRecord(board) || !Array.isArray(board.tiles)) {
    throw new Error('Plateau Pirates en vadrouille invalide');
  }
  if (
    !isRecord(cards) ||
    !Array.isArray(cards.treasure) ||
    !Array.isArray(cards.obstacle) ||
    !Array.isArray(cards.bonus)
  ) {
    throw new Error('Cartes Pirates en vadrouille invalides');
  }
  if (!board.tiles.every(isTile)) throw new Error('Cases pirates invalides');
  const groups = [cards.treasure, cards.obstacle, cards.bonus];
  if (groups.some((group) => !group.every(isCard))) {
    throw new Error('Définition de carte pirate invalide');
  }
  return {
    tiles: board.tiles,
    treasure: cards.treasure,
    obstacle: cards.obstacle,
    bonus: cards.bonus,
  };
}

function contentDirectory(): string {
  const candidates = [
    resolve(__dirname, 'model/content'),
    resolve(
      process.cwd(),
      'src/game/games/les-quatre-vents/pirates-en-vadrouille/model/content',
    ),
    resolve(
      process.cwd(),
      'dist/game/games/les-quatre-vents/pirates-en-vadrouille/model/content',
    ),
  ];
  const found = candidates.find((directory) =>
    existsSync(resolve(directory, 'board.json')),
  );
  if (!found) throw new Error('Contenu Pirates en vadrouille introuvable');
  return found;
}

function isTile(value: unknown): value is PirateTile {
  return (
    isRecord(value) &&
    typeof value.n === 'number' &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    [
      'start',
      'neutral',
      'bonus',
      'treasure',
      'obstacle',
      'gold',
      'finish',
    ].includes(String(value.type))
  );
}

function isCard(value: unknown): value is PirateCard {
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
