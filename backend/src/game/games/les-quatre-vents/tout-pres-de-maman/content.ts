import {
  defineEffectRecipe,
  gameEffects,
  loadGameContent,
  rejectContent,
} from '../../../engine/sdk/public-api';
import type {
  GameContent,
  GameEffectInstruction,
} from '../../../engine/sdk/public-api';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { MamanCard, MamanTile } from './types';

type RawMamanCard = Omit<MamanCard, 'effects'>;

type MamanContent = { tiles: MamanTile[]; cards: MamanCard[] };

function loadContent(): GameContent<MamanContent> {
  const directory = contentDirectory();
  const board: unknown = JSON.parse(
    readFileSync(resolve(directory, 'board.json'), 'utf8'),
  );
  const cards: unknown = JSON.parse(
    readFileSync(resolve(directory, 'cards.json'), 'utf8'),
  );
  return loadGameContent(
    'tout-pres-de-maman',
    { board, cards },
    {
      parse: (value) => {
        if (
          !isRecord(value) ||
          !isRecord(value.board) ||
          !Array.isArray(value.board.tiles) ||
          !value.board.tiles.every(isTile) ||
          !isRecord(value.cards) ||
          !Array.isArray(value.cards.cards) ||
          !value.cards.cards.every(isCard)
        ) {
          rejectContent('Contenu de Tout près de Maman invalide');
        }
        return {
          tiles: value.board.tiles,
          cards: value.cards.cards.map((card) => ({
            ...card,
            effects: MAMAN_CARD_EFFECTS[card.id] ?? [],
          })),
        };
      },
    },
  );
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
  if (!found) rejectContent('Contenu de Tout près de Maman introuvable');
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

function isCard(value: unknown): value is RawMamanCard {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.text === 'string'
  );
}

const move = (delta: number): readonly GameEffectInstruction[] => [
  gameEffects.custom('maman.move', { delta }, gameEffects.target.self()),
];
const moveTo = (
  type: 'card' | 'token' | 'bonds',
  direction: 'forward' | 'backward',
): readonly GameEffectInstruction[] => [
  gameEffects.custom('maman.move-to-type', { type, direction }),
];
const target = (effectId: string): readonly GameEffectInstruction[] => [
  gameEffects.custom(effectId, {}, gameEffects.target.chosenOpponent(effectId)),
  gameEffects.completeTurn(),
];
const allMove = defineEffectRecipe((delta: number) => [
  gameEffects.custom('maman.move', { delta }, gameEffects.target.self()),
  gameEffects.custom(
    'maman.move',
    { delta },
    gameEffects.target.allOpponents(),
  ),
]);

const MAMAN_CARD_EFFECTS: Readonly<
  Record<number, readonly GameEffectInstruction[]>
> = {
  1: move(1),
  2: move(-1),
  3: [gameEffects.gainResource('eucalyptus', 1)],
  4: move(2),
  5: [gameEffects.skipTurn(1)],
  6: move(-2),
  7: moveTo('card', 'forward'),
  8: target('maman.transfer-token'),
  9: moveTo('token', 'backward'),
  10: allMove(-1),
  11: [
    gameEffects.addStatus({
      status: 'maman.bonus-reroll',
      scope: 'until-used',
    }),
  ],
  12: [gameEffects.gainResource('eucalyptus', 1)],
  13: [gameEffects.skipTurn(1)],
  14: move(3),
  15: moveTo('bonds', 'backward'),
  16: [gameEffects.custom('maman.roll-move')],
  17: move(-1),
  18: move(2),
  19: move(-2),
  20: [gameEffects.gainResource('eucalyptus', 1)],
  21: allMove(1),
  22: [gameEffects.skipTurn(1)],
  23: [gameEffects.custom('maman.roll-threshold-move')],
  24: moveTo('bonds', 'forward'),
  25: [
    gameEffects.loseResource('eucalyptus', 1, undefined, {
      allowPartial: true,
    }),
  ],
  26: [...move(1), ...target('maman.share-advance')],
  28: [gameEffects.skipTurn(1)],
  29: [...move(2), gameEffects.gainResource('eucalyptus', 1)],
  30: move(1),
};

export const MAMAN_GAME_CONTENT = loadContent();
export const MAMAN_CONTENT = MAMAN_GAME_CONTENT.data;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
