import type {
  EffectTarget,
  GameEffectInstruction,
} from '../../../engine/sdk/public-api';
import {
  cardContent,
  defineGameContent,
  effectContentSchema,
  gameEffects,
  gameInput,
  isRecord,
  rejectContent,
} from '../../../engine/sdk/public-api';
import data from './content-data.json';
import type {
  OlympiaCardDefinition,
  OlympiaDeckType,
  OlympiaEffect,
} from './content-types';
import {
  OLYMPIA_CATEGORIES,
  OLYMPIA_DECK_TYPES,
  OLYMPIA_STATUS_KEYS,
} from './content-types';
import manifest from './manifest.json';
export {
  OLYMPIA_CATEGORIES,
  OLYMPIA_DECK_TYPES,
  OLYMPIA_STATUS_KEYS,
} from './content-types';
export type {
  OlympiaCardDefinition,
  OlympiaCategory,
  OlympiaDeckType,
  OlympiaEffect,
  OlympiaStatusKey,
} from './content-types';

const defaultCards: OlympiaCardDefinition[] = data.cards.map((card) => {
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

const defaultDecks: Record<OlympiaDeckType, string[]> = {
  divinite: [],
  heros: [],
  creatures: [],
  exploits: [],
  actions: [],
  attaques: [],
  evenements: [],
};
for (const card of defaultCards) defaultDecks[card.deck].push(card.id);

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

const textSchema = gameInput.string({ min: 1, max: 4000, trim: false });
const idSchema = gameInput.string({ min: 1, max: 128 });
const deckSchema = gameInput.array(idSchema, { min: 1, max: 10000 });
const olympiaSchema = gameInput.object({
  cards: gameInput.array(
    gameInput.object({
      id: idSchema,
      name: textSchema,
      description: textSchema,
      category: gameInput.enum(OLYMPIA_CATEGORIES),
      deck: gameInput.enum(OLYMPIA_DECK_TYPES),
      points: gameInput.optional(
        gameInput.number({ integer: true, min: -1000000, max: 1000000 }),
      ),
      effect: gameInput.optional({
        parse: parseEffects,
        describe: () => ({ type: 'object' }),
      }),
      effects: effectContentSchema({
        effects: [
          'olympia.prestige',
          'olympia.steal',
          'olympia.draw',
          'olympia.discard',
          'olympia.exchange',
        ],
      }),
    }),
    { min: 1, max: 10000 },
  ),
  decks: gameInput.object({
    divinite: deckSchema,
    heros: deckSchema,
    creatures: deckSchema,
    exploits: deckSchema,
    actions: deckSchema,
    attaques: deckSchema,
    evenements: deckSchema,
  }),
});
export const OLYMPIA_GAME_CONTENT = defineGameContent(
  manifest.code,
  { decks: defaultDecks, cards: defaultCards },
  {
    snapshotMigrations: [
      {
        fromVersion: 'olympia@content:25cb5135',
        toVersion: 'olympia@content:5429cc55',
      },
    ],
    schema: {
      parse(value: unknown) {
        const source =
          isRecord(value) && !Object.hasOwn(value, 'cards')
            ? { ...value, cards: defaultCards }
            : value;
        const parsed = olympiaSchema.parse(source);
        const cards = cardContent(parsed.cards);
        const byId = new Map(cards.map((card) => [card.id, card]));
        const assigned = new Set<string>();
        for (const [deck, ids] of Object.entries(parsed.decks)) {
          for (const id of ids) {
            if (assigned.has(id) || byId.get(id)?.deck !== deck)
              rejectContent('Référence de carte Olympia invalide');
            assigned.add(id);
          }
        }
        if (assigned.size !== cards.length)
          rejectContent('Carte Olympia sans pioche');
        return { decks: parsed.decks, cards };
      },
    },
  },
);
export const OLYMPIA_CARDS = OLYMPIA_GAME_CONTENT.data.cards;
export const OLYMPIA_DECKS = OLYMPIA_GAME_CONTENT.data.decks;
export const OLYMPIA_CARD_BY_ID = Object.freeze(
  Object.fromEntries(OLYMPIA_CARDS.map((card) => [card.id, card])),
);
