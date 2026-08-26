import {
  freezeGameContent,
  gameEffects,
  rejectContent,
} from '../../../core/application/public-api';
import type { GameEffectInstruction } from '../../../core/application/public-api';
import boardContent from './model/content/board.json';
import coursesContent from './model/content/courses.json';
import eventsContent from './model/content/events.json';
import exchangesContent from './model/content/exchanges.json';
import pawnsContent from './model/content/pawns.json';
import quizzesContent from './model/content/quizzes.json';
import listsContent from './model/content/shopping-lists.json';
import standsContent from './model/content/stands.json';

export type PanierTileType =
  | 'start'
  | 'rest'
  | 'stand'
  | 'event'
  | 'exchange'
  | 'quiz'
  | 'move'
  | 'move_choice'
  | 'skip'
  | 'bonus_course'
  | 'move_to_stand';

export type PanierTile = {
  id: string;
  type: PanierTileType;
  label: string;
  description: string;
  standId?: string;
  delta?: number;
  turns?: number;
};

type PanierEventEffect =
  | { kind: 'move'; delta: number }
  | { kind: 'draw'; count: number; everyone?: boolean }
  | { kind: 'skip'; turns: number }
  | { kind: 'extra-turn' }
  | { kind: 'discard'; count: number; everyone?: boolean }
  | { kind: 'reverse' }
  | { kind: 'steal' }
  | { kind: 'swap-inventories' }
  | { kind: 'quiz' }
  | { kind: 'nearest-stand' }
  | { kind: 'reveal' };

type PanierExchangeEffect =
  'random-swap' | 'strategic-swap' | 'swap-inventories' | 'steal' | 'discard';

export const PANIER_TILES: PanierTile[] = boardContent.tiles.map((tile) => ({
  ...tile,
  type: tileType(tile.type),
}));
export const PANIER_COURSES = [...coursesContent.items];
export const PANIER_LISTS = listsContent.lists.map((list) => [...list]);
export const PANIER_STANDS = Object.fromEntries(
  standsContent.stands.map((stand) => [stand.id, [...stand.items]]),
);
export const PANIER_PAWNS = pawnsContent.pawns.map((pawn) => ({ ...pawn }));
export const PANIER_QUIZZES = quizzesContent.quizzes.map((question) => ({
  id: question.id,
  prompt: question.question,
  choices: [...question.choices],
  answerIndex: question.choices.indexOf(question.answer),
}));

const EVENT_EFFECTS: PanierEventEffect[] = [
  { kind: 'draw', count: 2 },
  { kind: 'move', delta: 2 },
  { kind: 'draw', count: 1 },
  { kind: 'extra-turn' },
  { kind: 'steal' },
  { kind: 'draw', count: 3 },
  { kind: 'draw', count: 1 },
  { kind: 'draw', count: 1, everyone: true },
  { kind: 'nearest-stand' },
  { kind: 'steal' },
  { kind: 'draw', count: 1, everyone: true },
  { kind: 'draw', count: 2 },
  { kind: 'draw', count: 1 },
  { kind: 'draw', count: 1, everyone: true },
  { kind: 'discard', count: 1 },
  { kind: 'skip', turns: 1 },
  { kind: 'discard', count: 1 },
  { kind: 'move', delta: -3 },
  { kind: 'skip', turns: 1 },
  { kind: 'skip', turns: 1 },
  { kind: 'skip', turns: 2 },
  { kind: 'discard', count: 1 },
  { kind: 'discard', count: 1 },
  { kind: 'discard', count: 1 },
  { kind: 'move', delta: -2 },
  { kind: 'skip', turns: 1 },
  { kind: 'reveal' },
  { kind: 'discard', count: 2 },
  { kind: 'steal' },
  { kind: 'swap-inventories' },
  { kind: 'steal' },
  { kind: 'discard', count: 1, everyone: true },
  { kind: 'discard', count: 1 },
  { kind: 'extra-turn' },
  { kind: 'nearest-stand' },
  { kind: 'steal' },
  { kind: 'reveal' },
  { kind: 'discard', count: 1 },
  { kind: 'reverse' },
  { kind: 'skip', turns: 1 },
];

const EXCHANGE_EFFECTS: PanierExchangeEffect[] = [
  'strategic-swap',
  'strategic-swap',
  'random-swap',
  'random-swap',
  'random-swap',
  'random-swap',
  'swap-inventories',
  'strategic-swap',
  'swap-inventories',
  'strategic-swap',
  'steal',
  'random-swap',
  'strategic-swap',
  'discard',
  'random-swap',
  'steal',
  'strategic-swap',
  'random-swap',
];

export const PANIER_EVENTS = eventsContent.events.map((id, index) => ({
  id,
  effects: eventInstructions(requiredEventEffect(index, id)),
}));

export const PANIER_EXCHANGES = exchangesContent.exchanges.map((id, index) => ({
  id,
  effects: exchangeInstructions(requiredExchangeEffect(index, id)),
}));

function eventInstructions(
  effect: PanierEventEffect,
): readonly GameEffectInstruction[] {
  if (effect.kind === 'move') {
    return [gameEffects.custom('panier.move', { delta: effect.delta })];
  }
  if (effect.kind === 'draw') {
    return [
      gameEffects.custom('panier.draw', {
        count: effect.count,
        everyone: effect.everyone ?? false,
      }),
    ];
  }
  if (effect.kind === 'skip') return [gameEffects.skipTurn(effect.turns)];
  if (effect.kind === 'extra-turn') return [gameEffects.extraTurn()];
  if (effect.kind === 'discard') {
    return [
      gameEffects.custom('panier.discard', {
        count: effect.count,
        everyone: effect.everyone ?? false,
      }),
    ];
  }
  if (effect.kind === 'reverse') {
    return [gameEffects.custom('panier.reverse')];
  }
  if (effect.kind === 'quiz') return [gameEffects.custom('panier.quiz')];
  if (effect.kind === 'nearest-stand') {
    return [gameEffects.custom('panier.nearest-stand')];
  }
  if (effect.kind === 'reveal') {
    return [
      gameEffects.addStatus({
        status: 'panier.reveal',
        turns: 1,
        scope: 'turn',
      }),
    ];
  }
  return targetInstructions(effect.kind);
}

function exchangeInstructions(
  effect: PanierExchangeEffect,
): readonly GameEffectInstruction[] {
  return effect === 'discard'
    ? [gameEffects.custom('panier.discard', { count: 1, everyone: false })]
    : targetInstructions(effect);
}

function targetInstructions(
  kind: Exclude<PanierExchangeEffect, 'discard'> | 'steal' | 'swap-inventories',
): readonly GameEffectInstruction[] {
  return [
    gameEffects.custom(
      'panier.target',
      { kind },
      gameEffects.target.chosenOpponent(`panier.${kind}`),
    ),
    gameEffects.completeTurn(),
  ];
}

function requiredEventEffect(index: number, id: string): PanierEventEffect {
  const effect = EVENT_EFFECTS[index];
  if (!effect) rejectContent(`Effet événement Panier manquant: ${id}`);
  return effect;
}

function requiredExchangeEffect(
  index: number,
  id: string,
): PanierExchangeEffect {
  const effect = EXCHANGE_EFFECTS[index];
  if (!effect) rejectContent(`Effet échange Panier manquant: ${id}`);
  return effect;
}

function tileType(value: string): PanierTileType {
  if (
    value === 'start' ||
    value === 'rest' ||
    value === 'stand' ||
    value === 'event' ||
    value === 'exchange' ||
    value === 'quiz' ||
    value === 'move' ||
    value === 'move_choice' ||
    value === 'skip' ||
    value === 'bonus_course' ||
    value === 'move_to_stand'
  )
    return value;
  rejectContent(`Type de case Panier inconnu: ${value}`);
}

freezeGameContent(PANIER_TILES);
freezeGameContent(PANIER_COURSES);
freezeGameContent(PANIER_LISTS);
freezeGameContent(PANIER_STANDS);
freezeGameContent(PANIER_PAWNS);
freezeGameContent(PANIER_QUIZZES);
freezeGameContent(PANIER_EVENTS);
freezeGameContent(PANIER_EXCHANGES);
