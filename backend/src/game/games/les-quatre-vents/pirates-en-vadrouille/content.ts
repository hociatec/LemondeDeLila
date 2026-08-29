import {
  freezeGameContent,
  gameEffects,
  rejectContent,
} from '../../../engine/sdk/public-api';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PirateCard, PirateTile } from './state';

type PirateContent = {
  tiles: PirateTile[];
  treasure: PirateCard[];
  obstacle: PirateCard[];
  bonus: PirateCard[];
};

type RawPirateCard = Omit<PirateCard, 'effects'>;

const TRACK = 'island';
const GOLD = 'pirate-gold';
const OBSTACLE_IMMUNITY = 'pirates.obstacle-immunity';
const chosenOpponent = gameEffects.target.chosenOpponent();

const BONUS_EFFECTS: Readonly<
  Record<number, readonly PirateCard['effects'][number][]>
> = {
  1: [gameEffects.move(TRACK, 2)],
  2: [immunity(1)],
  3: [gameEffects.extraTurn()],
  4: [gameEffects.move(TRACK, 2)],
  5: [immunity(1)],
  6: [gameEffects.move(TRACK, 3)],
  7: [gameEffects.move(TRACK, -1, chosenOpponent), gameEffects.completeTurn()],
  8: [gameEffects.gainResource(GOLD, 1)],
  9: [
    gameEffects.custom('pirates.steal-treasure', {}, chosenOpponent),
    gameEffects.completeTurn(),
  ],
  10: [immunity(2)],
};

const OBSTACLE_EFFECTS: Readonly<
  Record<number, readonly PirateCard['effects'][number][]>
> = {
  1: [gameEffects.move(TRACK, -2)],
  2: [gameEffects.skipTurn(1)],
  3: [gameEffects.skipTurn(1)],
  4: [gameEffects.move(TRACK, -1)],
  5: [gameEffects.skipTurn(1)],
  6: [gameEffects.skipTurn(1)],
  7: [gameEffects.loseResource(GOLD, 1, undefined, { allowPartial: true })],
  8: [gameEffects.skipTurn(2)],
  9: [gameEffects.move(TRACK, -1)],
  10: [gameEffects.loseResource(GOLD, 1, undefined, { allowPartial: true })],
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
  if (!isRecord(board) || !isArrayOf(board.tiles, isTile)) {
    rejectContent('Plateau Pirates en vadrouille invalide');
  }
  if (
    !isRecord(cards) ||
    !isArrayOf(cards.treasure, isCard) ||
    !isArrayOf(cards.obstacle, isCard) ||
    !isArrayOf(cards.bonus, isCard)
  ) {
    rejectContent('Cartes Pirates en vadrouille invalides');
  }
  return {
    tiles: board.tiles,
    treasure: cards.treasure.map((card) => ({ ...card, effects: [] })),
    obstacle: cards.obstacle.map((card) => ({
      ...card,
      effects: OBSTACLE_EFFECTS[card.id] ?? [],
    })),
    bonus: cards.bonus.map((card) => ({
      ...card,
      effects: BONUS_EFFECTS[card.id] ?? [],
    })),
  };
}

function immunity(turns: number): PirateCard['effects'][number] {
  return gameEffects.addStatus({
    status: OBSTACLE_IMMUNITY,
    turns,
    scope: 'until-used',
    stack: true,
  });
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
  if (!found) rejectContent('Contenu Pirates en vadrouille introuvable');
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

function isCard(value: unknown): value is RawPirateCard {
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

function isArrayOf<T>(
  value: unknown,
  guard: (item: unknown) => item is T,
): value is T[] {
  return Array.isArray(value) && value.every(guard);
}

freezeGameContent(PIRATES_CONTENT);
