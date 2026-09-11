import canonicalContent from './catalogue.json';
import manifest from './manifest.json';

import {
  defineGameContent,
  gameInput,
  cardContent,
  effectContentSchema,
  rejectContent,
} from '../../../engine/sdk/public-api';

import type { GameEffectInstruction } from '../../../engine/sdk/public-api';

export type LesMainsFamily =
  'tradition' | 'nature' | 'mer' | 'art' | 'insolites' | 'innovation' | 'sante';

export type LesMainsCardType = 'metier' | 'special';

export const LES_MAINS_FAMILIES: readonly LesMainsFamily[] = Object.freeze([
  'tradition',
  'nature',
  'mer',
  'art',
  'insolites',
  'innovation',
  'sante',
]);

export interface LesMainsCardDefinition {
  id: string;
  name: string;
  type: LesMainsCardType;
  family?: LesMainsFamily;
  effects: readonly GameEffectInstruction[];
}

export const LES_MAINS_FAMILY_SIZE = 6;

const deckSchema = gameInput.object({
  cards: gameInput.array(
    gameInput.object({
      id: gameInput.string({ min: 1, max: 128 }),
      name: gameInput.string({ min: 1, max: 200 }),
      type: gameInput.enum(['metier', 'special']),
      family: gameInput.optional(
        gameInput.enum([
          'tradition',
          'nature',
          'mer',
          'art',
          'insolites',
          'innovation',
          'sante',
        ]),
      ),
      effects: effectContentSchema({
        effects: [
          'les-mains.exchange-random',
          'les-mains.complete-vanished',
          'les-mains.mix-hands',
          'les-mains.pass-knowledge',
          'les-mains.log-special',
        ],
      }),
    }),
    { min: 1, max: 10000 },
  ),
});

export const LES_MAINS_GAME_CONTENT = defineGameContent(
  manifest.code,
  canonicalContent,
  {
    schema: {
      parse(value: unknown) {
        const parsed = deckSchema.parse(value);
        for (const card of parsed.cards) {
          if (card.type === 'metier' && !card.family)
            rejectContent('Famille requise');
          if (card.type === 'special' && card.family)
            rejectContent('Une carte spéciale ne fait pas partie des métiers');
        }
        for (const family of LES_MAINS_FAMILIES) {
          if (
            parsed.cards.filter(
              (card) => card.type === 'metier' && card.family === family,
            ).length !== LES_MAINS_FAMILY_SIZE
          )
            rejectContent('Chaque famille doit contenir six métiers');
        }
        return { cards: cardContent(parsed.cards) };
      },
    },
  },
);

export const LES_MAINS_DECK = LES_MAINS_GAME_CONTENT.data.cards;

export const LES_MAINS_METIER_CARDS = Object.freeze(
  LES_MAINS_DECK.filter((card) => card.type === 'metier'),
);

export const LES_MAINS_SPECIAL_CARDS = Object.freeze(
  LES_MAINS_DECK.filter((card) => card.type === 'special'),
);

export const LES_MAINS_CARD_BY_ID: Readonly<
  Record<string, LesMainsCardDefinition>
> = Object.freeze(
  Object.fromEntries(LES_MAINS_DECK.map((card) => [card.id, card])),
);

export const isLesMainsSpecialCard = (cardId: string): boolean =>
  LES_MAINS_SPECIAL_CARDS.some((card) => card.id === cardId);
