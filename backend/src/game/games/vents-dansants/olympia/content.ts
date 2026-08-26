import {
  freezeGameContent,
  gameEffects,
  rejectContent,
} from '../../../core/application/public-api';
import type {
  EffectTarget,
  GameEffectInstruction,
} from '../../../core/application/public-api';
import data from './content-data.json';

export type OlympiaCategory =
  | 'divinite'
  | 'heros'
  | 'creature'
  | 'exploit'
  | 'action'
  | 'attaque'
  | 'evenement';
export type OlympiaDeckType =
  | 'divinite'
  | 'heros'
  | 'creatures'
  | 'exploits'
  | 'actions'
  | 'attaques'
  | 'evenements';
export type OlympiaStatusKey =
  | 'block_play'
  | 'block_hero'
  | 'block_exploit'
  | 'block_hero_exploit'
  | 'shield'
  | 'halved_gains'
  | 'neutralize_creature'
  | 'double_exploit'
  | 'divinity_block'
  | 'global_block_hero'
  | 'global_block_exploit'
  | 'block_draw_hero'
  | 'exploit_bonus'
  | 'event_protection'
  | 'block_actions'
  | 'exploit_penalty';
export type OlympiaEffect =
  | {
      type: 'prestige';
      target: 'self' | 'target' | 'all' | 'others';
      value: number;
    }
  | { type: 'steal'; value: number }
  | {
      type: 'draw';
      target: 'self' | 'all';
      amount: number;
      decks: OlympiaDeckType[];
    }
  | {
      type: 'status';
      key: OlympiaStatusKey;
      target: 'self' | 'target' | 'all' | 'others';
      turns: number;
      value?: number;
    }
  | {
      type: 'discard';
      target: 'target' | 'all';
      categories: OlympiaCategory[];
      amount: number;
    }
  | { type: 'exchange'; categories: OlympiaCategory[] }
  | { type: 'skip'; target: 'target'; turns: number };

export interface OlympiaCardDefinition {
  id: string;
  name: string;
  description: string;
  category: OlympiaCategory;
  deck: OlympiaDeckType;
  points?: number;
  effect?: OlympiaEffect | OlympiaEffect[];
  effects: readonly GameEffectInstruction[];
}

export const OLYMPIA_CATEGORIES: OlympiaCategory[] = [
  'divinite',
  'heros',
  'creature',
  'exploit',
  'action',
  'attaque',
  'evenement',
];
export const OLYMPIA_DECK_TYPES: OlympiaDeckType[] = [
  'divinite',
  'heros',
  'creatures',
  'exploits',
  'actions',
  'attaques',
  'evenements',
];
export const OLYMPIA_STATUS_KEYS: OlympiaStatusKey[] = [
  'block_play',
  'block_hero',
  'block_exploit',
  'block_hero_exploit',
  'shield',
  'halved_gains',
  'neutralize_creature',
  'double_exploit',
  'divinity_block',
  'global_block_hero',
  'global_block_exploit',
  'block_draw_hero',
  'exploit_bonus',
  'event_protection',
  'block_actions',
  'exploit_penalty',
];

export const OLYMPIA_CARDS: OlympiaCardDefinition[] = data.cards.map((card) => {
  const effect = 'effect' in card ? parseEffects(card.effect) : undefined;
  const effects =
    effect == null
      ? []
      : (Array.isArray(effect) ? effect : [effect]).flatMap((instruction) =>
          effectInstructions(instruction, `olympia.${card.id}.target`),
        );
  return {
    id: card.id,
    name: card.name,
    description: card.description,
    category: required(OLYMPIA_CATEGORIES, card.category, 'catégorie'),
    deck: required(OLYMPIA_DECK_TYPES, card.deck, 'pioche'),
    ...('points' in card ? { points: card.points } : {}),
    ...(effect ? { effect } : {}),
    effects,
  };
});

export const OLYMPIA_DECKS: Record<OlympiaDeckType, string[]> = {
  divinite: [],
  heros: [],
  creatures: [],
  exploits: [],
  actions: [],
  attaques: [],
  evenements: [],
};
for (const card of OLYMPIA_CARDS) OLYMPIA_DECKS[card.deck].push(card.id);
export const OLYMPIA_CARD_BY_ID = Object.fromEntries(
  OLYMPIA_CARDS.map((card) => [card.id, card]),
);

function parseEffects(value: unknown): OlympiaEffect | OlympiaEffect[] {
  return Array.isArray(value) ? value.map(parseEffect) : parseEffect(value);
}

function parseEffect(value: unknown): OlympiaEffect {
  if (!isRecord(value)) rejectContent('Effet Olympia invalide');
  const type = text(value.type);
  if (type === 'prestige')
    return {
      type,
      target: target(value.target, ['self', 'target', 'all', 'others']),
      value: number(value.value),
    };
  if (type === 'steal') return { type, value: number(value.value) };
  if (type === 'draw')
    return {
      type,
      target: target(value.target, ['self', 'all']),
      amount: number(value.amount),
      decks: stringArray(value.decks).map((deck) =>
        required(OLYMPIA_DECK_TYPES, deck, 'pioche'),
      ),
    };
  if (type === 'status') {
    const optionalValue = value.value;
    return {
      type,
      key: required(OLYMPIA_STATUS_KEYS, text(value.key), 'statut'),
      target: target(value.target, ['self', 'target', 'all', 'others']),
      turns: number(value.turns),
      ...(typeof optionalValue === 'number' ? { value: optionalValue } : {}),
    };
  }
  if (type === 'discard')
    return {
      type,
      target: target(value.target, ['target', 'all']),
      categories: stringArray(value.categories).map((category) =>
        required(OLYMPIA_CATEGORIES, category, 'catégorie'),
      ),
      amount: number(value.amount),
    };
  if (type === 'exchange')
    return {
      type,
      categories: stringArray(value.categories).map((category) =>
        required(OLYMPIA_CATEGORIES, category, 'catégorie'),
      ),
    };
  if (type === 'skip')
    return {
      type,
      target: target(value.target, ['target']),
      turns: number(value.turns),
    };
  rejectContent(`Type d’effet Olympia inconnu: ${type}`);
}

function effectInstructions(
  effect: OlympiaEffect,
  choiceId: string,
): readonly GameEffectInstruction[] {
  if (effect.type === 'prestige') {
    return forTargets(effect.target, choiceId, (target) =>
      gameEffects.custom('olympia.prestige', { value: effect.value }, target),
    );
  }
  if (effect.type === 'steal') {
    return [
      gameEffects.custom(
        'olympia.steal',
        { value: effect.value },
        gameEffects.target.chosenOpponent(choiceId),
      ),
    ];
  }
  if (effect.type === 'draw') {
    return forTargets(effect.target, choiceId, (target) =>
      gameEffects.custom(
        'olympia.draw',
        { amount: effect.amount, decks: effect.decks },
        target,
      ),
    );
  }
  if (effect.type === 'status') {
    return forTargets(effect.target, choiceId, (target) =>
      gameEffects.addStatus({
        status: effect.key,
        turns: effect.turns,
        scope: 'global-turn',
        ...(effect.value == null ? {} : { data: { value: effect.value } }),
        target,
      }),
    );
  }
  if (effect.type === 'discard') {
    return forTargets(effect.target, choiceId, (target) =>
      gameEffects.custom(
        'olympia.discard',
        { amount: effect.amount, categories: effect.categories },
        target,
      ),
    );
  }
  if (effect.type === 'exchange') {
    return [
      gameEffects.custom(
        'olympia.exchange',
        { categories: effect.categories },
        gameEffects.target.chosenOpponent(choiceId),
      ),
    ];
  }
  return [
    gameEffects.skipTurn(
      effect.turns,
      gameEffects.target.chosenOpponent(choiceId),
    ),
  ];
}

function forTargets(
  descriptor: 'self' | 'target' | 'all' | 'others',
  choiceId: string,
  instruction: (target: EffectTarget) => GameEffectInstruction,
): readonly GameEffectInstruction[] {
  if (descriptor === 'self') return [instruction(gameEffects.target.self())];
  if (descriptor === 'target') {
    return [instruction(gameEffects.target.chosenOpponent(choiceId))];
  }
  if (descriptor === 'others') {
    return [instruction(gameEffects.target.allOpponents())];
  }
  return [
    instruction(gameEffects.target.self()),
    instruction(gameEffects.target.allOpponents()),
  ];
}

function required<T extends string>(
  values: readonly T[],
  value: string,
  label: string,
): T {
  const found = values.find((candidate) => candidate === value);
  if (!found) rejectContent(`${label} Olympia inconnue: ${value}`);
  return found;
}

export function isOlympiaStatusKey(value: string): value is OlympiaStatusKey {
  return OLYMPIA_STATUS_KEYS.some((candidate) => candidate === value);
}

function target<T extends string>(value: unknown, values: readonly T[]): T {
  return required(values, text(value), 'cible');
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    rejectContent('Nombre Olympia invalide');
  return value;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string'))
    rejectContent('Liste Olympia invalide');
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

freezeGameContent(OLYMPIA_CARDS);
freezeGameContent(OLYMPIA_DECKS);
freezeGameContent(OLYMPIA_CARD_BY_ID);
