import {
  freezeGameContent,
  gameEffects,
  rejectContent,
} from '../../../engine/sdk/public-api';
import type { GameEffectInstruction } from '../../../engine/sdk/public-api';
import boardContent from './model/content/board.json';
import cardsContent from './model/content/cards.json';
import pawnsContent from './model/content/pawns.json';

export type FrousseCategory = 'trap' | 'prank' | 'ghost' | 'bonus';

export type FrousseCardEffect =
  | { kind: 'move'; delta: number }
  | { kind: 'skip'; turns: number }
  | { kind: 'goto'; position: number }
  | { kind: 'block'; rule: FrousseBlock; replay?: boolean }
  | { kind: 'cap'; maximum: number }
  | { kind: 'swap'; canDecline: boolean }
  | { kind: 'replay'; modifier?: 'minus-two' | 'keep-lowest' }
  | {
      kind: 'shield';
      category: Exclude<FrousseCategory, 'bonus'> | 'trap-until-draw';
    }
  | { kind: 'double' }
  | { kind: 'three-back-two' }
  | { kind: 'move-others-and-skip'; delta: number; turns: number };

export type FrousseBlock =
  | { kind: 'one-of'; allowed: number[] }
  | { kind: 'minimum'; minimum: number }
  | { kind: 'even' };

export type FrousseCard = {
  id: number;
  localNumber: number;
  category: FrousseCategory;
  text: string;
  effects: readonly GameEffectInstruction[];
};

const EFFECTS: Record<number, FrousseCardEffect> = {
  1: { kind: 'move', delta: -3 },
  2: { kind: 'skip', turns: 1 },
  3: { kind: 'block', rule: { kind: 'one-of', allowed: [5, 6] } },
  4: { kind: 'move', delta: -2 },
  5: { kind: 'skip', turns: 1 },
  6: { kind: 'move', delta: -1 },
  7: { kind: 'goto', position: 0 },
  8: { kind: 'cap', maximum: 1 },
  9: { kind: 'block', rule: { kind: 'one-of', allowed: [6] } },
  10: { kind: 'move', delta: -4 },
  11: { kind: 'skip', turns: 1 },
  12: { kind: 'block', rule: { kind: 'minimum', minimum: 4 } },
  13: { kind: 'move', delta: -1 },
  14: { kind: 'skip', turns: 1 },
  15: { kind: 'move', delta: -1 },
  16: { kind: 'block', rule: { kind: 'even' } },
  17: { kind: 'move', delta: -5 },
  18: { kind: 'skip', turns: 2 },
  19: { kind: 'move', delta: -3 },
  20: { kind: 'block', rule: { kind: 'even' }, replay: true },
  21: { kind: 'move', delta: -2 },
  22: { kind: 'skip', turns: 1 },
  23: { kind: 'swap', canDecline: true },
  24: { kind: 'move', delta: 2 },
  25: { kind: 'replay', modifier: 'minus-two' },
  26: { kind: 'skip', turns: 2 },
  27: { kind: 'move', delta: -1 },
  28: { kind: 'move', delta: -1 },
  29: { kind: 'skip', turns: 1 },
  30: { kind: 'move', delta: -3 },
  31: { kind: 'replay', modifier: 'keep-lowest' },
  32: { kind: 'move', delta: -4 },
  33: { kind: 'shield', category: 'trap' },
  34: { kind: 'skip', turns: 1 },
  35: { kind: 'move', delta: -1 },
  36: { kind: 'replay', modifier: 'keep-lowest' },
  37: { kind: 'skip', turns: 1 },
  38: { kind: 'swap', canDecline: false },
  39: { kind: 'move', delta: -5 },
  40: { kind: 'goto', position: 19 },
  41: { kind: 'move', delta: 1 },
  42: { kind: 'skip', turns: 1 },
  43: { kind: 'three-back-two' },
  44: { kind: 'move', delta: 2 },
  45: { kind: 'shield', category: 'trap' },
  46: { kind: 'move', delta: 4 },
  47: { kind: 'double' },
  48: { kind: 'move-others-and-skip', delta: 3, turns: 1 },
  49: { kind: 'move', delta: 2 },
  50: { kind: 'shield', category: 'trap-until-draw' },
  51: { kind: 'move', delta: 3 },
  52: { kind: 'replay' },
  53: { kind: 'move', delta: 5 },
  54: { kind: 'replay' },
  55: { kind: 'shield', category: 'ghost' },
  56: { kind: 'move', delta: 2 },
  57: { kind: 'move', delta: 6 },
  58: { kind: 'shield', category: 'prank' },
  59: { kind: 'goto', position: 39 },
  60: { kind: 'skip', turns: 1 },
};

export const FROUSSE_CARDS: FrousseCard[] = cardsContent.cards.map((card) => ({
  ...card,
  category: categoryOf(card.category),
  effects: effectInstructions(effectOf(card.id)),
}));

export const FROUSSE_TILES = boardContent.tiles.map((tile) => ({
  ...tile,
  type: tileTypeOf(tile.type),
}));

export const FROUSSE_PAWNS = pawnsContent.pawns.map((pawn) => ({ ...pawn }));

function effectOf(id: number): FrousseCardEffect {
  const effect = EFFECTS[id];
  if (!effect) rejectContent(`Effet Frousse manquant pour la carte ${id}`);
  return effect;
}

function effectInstructions(
  effect: FrousseCardEffect,
): readonly GameEffectInstruction[] {
  if (effect.kind === 'move') {
    return [gameEffects.custom('frousse.move', { delta: effect.delta })];
  }
  if (effect.kind === 'skip') return [gameEffects.skipTurn(effect.turns)];
  if (effect.kind === 'goto') {
    return [gameEffects.custom('frousse.goto', { position: effect.position })];
  }
  if (effect.kind === 'block') {
    return [
      gameEffects.addStatus({
        status: 'frousse.blocked',
        scope: 'until-used',
        data: { rule: effect.rule },
      }),
      ...(effect.replay ? [gameEffects.extraTurn()] : []),
    ];
  }
  if (effect.kind === 'cap') {
    return [
      gameEffects.addStatus({
        status: 'frousse.next-move-cap',
        scope: 'until-used',
        data: { value: effect.maximum },
      }),
    ];
  }
  if (effect.kind === 'swap') {
    return [
      gameEffects.custom(
        'frousse.swap',
        {},
        gameEffects.target.chosenOpponent('frousse.swap', effect.canDecline),
      ),
      gameEffects.completeTurn(),
    ];
  }
  if (effect.kind === 'replay' || effect.kind === 'shield') {
    return replayOrShieldInstructions(effect);
  }
  if (effect.kind === 'double') {
    return [
      gameEffects.addStatus({
        status: 'frousse.next-roll-double',
        scope: 'until-used',
      }),
    ];
  }
  if (effect.kind === 'three-back-two') {
    return [
      gameEffects.addStatus({
        status: 'frousse.next-roll-if-three-back-two',
        scope: 'until-used',
      }),
      gameEffects.extraTurn(),
    ];
  }
  return [
    gameEffects.custom(
      'frousse.move-others',
      { delta: effect.delta },
      gameEffects.target.allOpponents(),
    ),
    gameEffects.skipTurn(effect.turns),
  ];
}

function replayOrShieldInstructions(
  effect: Extract<FrousseCardEffect, { kind: 'replay' | 'shield' }>,
): readonly GameEffectInstruction[] {
  if (effect.kind === 'replay') {
    const modifierStatus =
      effect.modifier === 'minus-two'
        ? gameEffects.addStatus({
            status: 'frousse.next-roll-malus',
            scope: 'until-used',
            data: { value: -2 },
          })
        : effect.modifier === 'keep-lowest'
          ? gameEffects.addStatus({
              status: 'frousse.next-roll-keep-lowest',
              scope: 'until-used',
            })
          : null;
    return [
      gameEffects.extraTurn(),
      ...(modifierStatus ? [modifierStatus] : []),
    ];
  }
  const status =
    effect.category === 'trap'
      ? 'frousse.ignore-next-trap'
      : effect.category === 'prank'
        ? 'frousse.ignore-next-prank'
        : effect.category === 'ghost'
          ? 'frousse.ignore-next-ghost'
          : 'frousse.ignore-trap-until-next-draw';
  return [gameEffects.addStatus({ status, scope: 'until-used' })];
}

function categoryOf(value: string): FrousseCategory {
  if (value === 'Piège') return 'trap';
  if (value === 'Farce') return 'prank';
  if (value === 'Fantôme') return 'ghost';
  if (value === 'Bonus') return 'bonus';
  rejectContent(`Catégorie Frousse inconnue: ${value}`);
}

function tileTypeOf(value: string): 'neutral' | 'card' | 'finish' {
  if (value === 'neutral' || value === 'card' || value === 'finish')
    return value;
  rejectContent(`Case Frousse inconnue: ${value}`);
}

freezeGameContent(FROUSSE_CARDS);
freezeGameContent(FROUSSE_TILES);
freezeGameContent(FROUSSE_PAWNS);
