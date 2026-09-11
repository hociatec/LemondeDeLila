import manifest from './manifest.json';
import data from './content-data.json';
import {
  defineGameContent,
  gameInput,
  cardContent,
  rejectContent,
} from '../../../engine/sdk/public-api';

export interface DameNatureFamilyCardDefinition {
  id: string;
  familyId: string;
  familyName: string;
  memberName: string;
  type: 'family';
}

export interface DameNatureQuizCardDefinition {
  id: string;
  question: string;
  choices: string[];
  answerIndex: number;
  type: 'quiz';
}

export interface DameNatureNatureCardDefinition {
  id: string;
  description: string;
  delta: number;
  type: 'nature';
}

const defaultFamilyCards: DameNatureFamilyCardDefinition[] =
  data.familyCards.map((card) => ({ ...card, type: 'family' }));
const defaultQuizCards: DameNatureQuizCardDefinition[] = data.quizCards.map(
  (card) => ({ ...card, type: 'quiz' }),
);
const defaultNatureCards: DameNatureNatureCardDefinition[] =
  data.natureCards.map((card) => ({ ...card, type: 'nature' }));

const id = gameInput.string({ min: 1, max: 128 });
const text = gameInput.string({ min: 1, max: 2000 });
const natureSchema = gameInput.object({
  cards: gameInput.array(
    gameInput.union([
      gameInput.object({
        id,
        type: gameInput.literal('family'),
        familyId: id,
        familyName: text,
        memberName: text,
      }),
      gameInput.object({
        id,
        type: gameInput.literal('quiz'),
        question: text,
        choices: gameInput.array(text, { min: 2, max: 20 }),
        answerIndex: gameInput.number({ integer: true, min: 0, max: 19 }),
      }),
      gameInput.object({
        id,
        type: gameInput.literal('nature'),
        description: text,
        delta: gameInput.number({ integer: true, min: -1000000, max: 1000000 }),
      }),
    ]),
    { min: 1, max: 10000 },
  ),
});
export const DAME_NATURE_GAME_CONTENT = defineGameContent(
  manifest.code,
  {
    cards: [...defaultFamilyCards, ...defaultQuizCards, ...defaultNatureCards],
  },
  {
    snapshotMigrations: [
      {
        fromVersion: 'dame-nature@content:593ce53d',
        toVersion: 'dame-nature@content:5fc7c131',
      },
    ],
    schema: {
      parse(value: unknown) {
        const parsed = natureSchema.parse(value);
        for (const type of ['family', 'quiz', 'nature']) {
          if (!parsed.cards.some((card) => card.type === type))
            rejectContent('Catalogue de cartes vide');
        }
        for (const card of parsed.cards) {
          if (card.type === 'quiz' && card.answerIndex >= card.choices.length)
            rejectContent('Réponses de quiz incohérentes');
        }
        return { cards: cardContent(parsed.cards) };
      },
    },
  },
);
export const DAME_NATURE_FAMILY_CARD_DEFINITIONS = Object.freeze(
  DAME_NATURE_GAME_CONTENT.data.cards.filter((card) => card.type === 'family'),
);
export const DAME_NATURE_QUIZ_CARDS = Object.freeze(
  DAME_NATURE_GAME_CONTENT.data.cards.filter((card) => card.type === 'quiz'),
);
export const DAME_NATURE_NATURE_CARDS = Object.freeze(
  DAME_NATURE_GAME_CONTENT.data.cards.filter((card) => card.type === 'nature'),
);
export const DAME_NATURE_CARD_BY_ID = Object.freeze(
  Object.fromEntries(
    DAME_NATURE_GAME_CONTENT.data.cards.map((card) => [card.id, card]),
  ),
);

export const DAME_NATURE_FAMILY_CARD_IDS = Object.freeze(
  DAME_NATURE_FAMILY_CARD_DEFINITIONS.map((card) => card.id),
);
export const DAME_NATURE_QUIZ_CARD_IDS = Object.freeze(
  DAME_NATURE_QUIZ_CARDS.map((card) => card.id),
);
export const DAME_NATURE_NATURE_CARD_IDS = Object.freeze(
  DAME_NATURE_NATURE_CARDS.map((card) => card.id),
);
