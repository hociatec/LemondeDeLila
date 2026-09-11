import manifest from './manifest.json';
import {
  defineGameContent,
  gameInput,
  cardContent,
  rejectContent,
} from '../../../engine/sdk/public-api';

export type ZigEtZagColor = 'vert-sauge' | 'bleu-ardoise';
export type ZigEtZagFamily = 'banane' | 'dentifrice' | 'pantoufle' | 'bougie';
export type ZigEtZagCardType = 'simple' | 'figure' | 'joker';

export interface ZigEtZagCardDefinition {
  id: string;
  name: string;
  type: ZigEtZagCardType;
  color: ZigEtZagColor;
  family?: ZigEtZagFamily;
  value: number;
  allowedFamilies?: ZigEtZagFamily[];
}

const FAMILY_DEFINITIONS: Record<
  ZigEtZagFamily,
  { label: string; color: ZigEtZagColor }
> = {
  banane: { label: 'Banane', color: 'vert-sauge' },
  dentifrice: { label: 'Dentifrice', color: 'vert-sauge' },
  pantoufle: { label: 'Pantoufle', color: 'bleu-ardoise' },
  bougie: { label: 'Bougie', color: 'bleu-ardoise' },
};
const ZIG_ET_ZAG_FAMILIES: readonly ZigEtZagFamily[] = [
  'banane',
  'dentifrice',
  'pantoufle',
  'bougie',
];

const SIMPLE_CARDS: Array<{ suffix: string; name: string; value: number }> = [
  { suffix: 'libellule', name: 'Libellule', value: 2 },
  { suffix: 'souris', name: 'Souris', value: 3 },
  { suffix: 'poisson', name: 'Poisson', value: 4 },
  { suffix: 'poule', name: 'Poule', value: 5 },
  { suffix: 'lezard', name: 'Lézard', value: 6 },
  { suffix: 'chevre', name: 'Chèvre', value: 7 },
  { suffix: 'chat', name: 'Chat', value: 8 },
  { suffix: 'dauphin', name: 'Dauphin', value: 9 },
  { suffix: 'loup', name: 'Loup', value: 10 },
];

const FIGURE_CARDS: Array<{ suffix: string; name: string; value: number }> = [
  { suffix: 'bergere', name: 'Bergère', value: 11 },
  { suffix: 'marin', name: 'Marin', value: 12 },
  { suffix: 'parachutiste', name: 'Parachutiste', value: 13 },
  { suffix: 'astronaute', name: 'Astronaute', value: 14 },
];

const deck: ZigEtZagCardDefinition[] = [];

ZIG_ET_ZAG_FAMILIES.forEach((family) => {
  const { label, color } = FAMILY_DEFINITIONS[family];
  SIMPLE_CARDS.forEach((card) => {
    deck.push({
      id: `${family}-${card.suffix}`,
      name: `${card.name} (${label})`,
      type: 'simple',
      color,
      family,
      value: card.value,
    });
  });
  FIGURE_CARDS.forEach((card) => {
    deck.push({
      id: `${family}-${card.suffix}`,
      name: `${card.name} (${label})`,
      type: 'figure',
      color,
      family,
      value: card.value,
    });
  });
});

deck.push(
  {
    id: 'joker-montgolfiere',
    name: 'Montgolfière',
    type: 'joker',
    color: 'vert-sauge',
    value: 15,
    allowedFamilies: ['banane', 'dentifrice'],
  },
  {
    id: 'joker-fusee',
    name: 'Fusée',
    type: 'joker',
    color: 'bleu-ardoise',
    value: 15,
    allowedFamilies: ['pantoufle', 'bougie'],
  },
);

const familySchema = gameInput.enum([
  'banane',
  'dentifrice',
  'pantoufle',
  'bougie',
]);
const deckSchema = gameInput.object({
  cards: gameInput.array(
    gameInput.object({
      id: gameInput.string({ min: 1, max: 128 }),
      name: gameInput.string({ min: 1, max: 200 }),
      type: gameInput.enum(['simple', 'figure', 'joker']),
      color: gameInput.enum(['vert-sauge', 'bleu-ardoise']),
      family: gameInput.optional(familySchema),
      value: gameInput.number({ integer: true, min: 0, max: 1000 }),
      allowedFamilies: gameInput.optional(
        gameInput.array(familySchema, { min: 1, max: 4 }),
      ),
    }),
    { min: 2, max: 1000 },
  ),
});
export const ZIG_ET_ZAG_GAME_CONTENT = defineGameContent(
  manifest.code,
  { cards: deck },
  {
    schema: {
      parse(value: unknown) {
        const parsed = deckSchema.parse(value);
        if (parsed.cards.length % 2 !== 0)
          rejectContent('Le paquet doit se partager entre deux joueurs');
        for (const card of parsed.cards) {
          if (card.type !== 'joker' && !card.family)
            rejectContent('Famille de carte requise');
          if (card.type === 'joker' && !card.allowedFamilies?.length)
            rejectContent('Familles du joker requises');
        }
        return { cards: cardContent(parsed.cards) };
      },
    },
  },
);
export const ZIG_ET_ZAG_DECK = ZIG_ET_ZAG_GAME_CONTENT.data.cards;
export const ZIG_ET_ZAG_TOTAL_CARDS = ZIG_ET_ZAG_DECK.length;
export const ZIG_ET_ZAG_CARD_BY_ID: Readonly<
  Record<string, ZigEtZagCardDefinition>
> = Object.freeze(
  Object.fromEntries(ZIG_ET_ZAG_DECK.map((card) => [card.id, card])),
);
