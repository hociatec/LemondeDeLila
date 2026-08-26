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
}

const categories: OlympiaCategory[] = [
  'divinite',
  'heros',
  'creature',
  'exploit',
  'action',
  'attaque',
  'evenement',
];
const decks: OlympiaDeckType[] = [
  'divinite',
  'heros',
  'creatures',
  'exploits',
  'actions',
  'attaques',
  'evenements',
];
const statusKeys: OlympiaStatusKey[] = [
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

export const OLYMPIA_CARDS: OlympiaCardDefinition[] = data.cards.map(
  (card) => ({
    id: card.id,
    name: card.name,
    description: card.description,
    category: required(categories, card.category, 'catégorie'),
    deck: required(decks, card.deck, 'pioche'),
    ...('points' in card ? { points: card.points } : {}),
    ...('effect' in card ? { effect: parseEffects(card.effect) } : {}),
  }),
);

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
  if (!isRecord(value)) throw new Error('Effet Olympia invalide');
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
        required(decks, deck, 'pioche'),
      ),
    };
  if (type === 'status') {
    const optionalValue = value.value;
    return {
      type,
      key: required(statusKeys, text(value.key), 'statut'),
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
        required(categories, category, 'catégorie'),
      ),
      amount: number(value.amount),
    };
  if (type === 'exchange')
    return {
      type,
      categories: stringArray(value.categories).map((category) =>
        required(categories, category, 'catégorie'),
      ),
    };
  if (type === 'skip')
    return {
      type,
      target: target(value.target, ['target']),
      turns: number(value.turns),
    };
  throw new Error(`Type d’effet Olympia inconnu: ${type}`);
}

function required<T extends string>(
  values: readonly T[],
  value: string,
  label: string,
): T {
  const found = values.find((candidate) => candidate === value);
  if (!found) throw new Error(`${label} Olympia inconnue: ${value}`);
  return found;
}

function target<T extends string>(value: unknown, values: readonly T[]): T {
  return required(values, text(value), 'cible');
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error('Nombre Olympia invalide');
  return value;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string'))
    throw new Error('Liste Olympia invalide');
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
