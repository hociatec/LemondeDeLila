import data from './content-data.json';
import { freezeGameContent } from '../../../core/application/public-api';

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
  options: string[];
  answer: string;
  type: 'quiz';
}

export interface DameNatureNatureCardDefinition {
  id: string;
  description: string;
  delta: number;
  type: 'nature';
}

export const DAME_NATURE_FAMILY_CARD_DEFINITIONS: DameNatureFamilyCardDefinition[] =
  data.familyCards.map((card) => ({ ...card, type: 'family' }));
export const DAME_NATURE_QUIZ_CARDS: DameNatureQuizCardDefinition[] =
  data.quizCards.map((card) => ({ ...card, type: 'quiz' }));
export const DAME_NATURE_NATURE_CARDS: DameNatureNatureCardDefinition[] =
  data.natureCards.map((card) => ({ ...card, type: 'nature' }));

export const DAME_NATURE_CARD_BY_ID = {
  ...Object.fromEntries(
    DAME_NATURE_FAMILY_CARD_DEFINITIONS.map((card) => [card.id, card]),
  ),
  ...Object.fromEntries(DAME_NATURE_QUIZ_CARDS.map((card) => [card.id, card])),
  ...Object.fromEntries(
    DAME_NATURE_NATURE_CARDS.map((card) => [card.id, card]),
  ),
};

export const DAME_NATURE_FAMILY_CARD_IDS =
  DAME_NATURE_FAMILY_CARD_DEFINITIONS.map((card) => card.id);
export const DAME_NATURE_QUIZ_CARD_IDS = DAME_NATURE_QUIZ_CARDS.map(
  (card) => card.id,
);
export const DAME_NATURE_NATURE_CARD_IDS = DAME_NATURE_NATURE_CARDS.map(
  (card) => card.id,
);

freezeGameContent(DAME_NATURE_FAMILY_CARD_DEFINITIONS);
freezeGameContent(DAME_NATURE_QUIZ_CARDS);
freezeGameContent(DAME_NATURE_NATURE_CARDS);
freezeGameContent(DAME_NATURE_CARD_BY_ID);
freezeGameContent(DAME_NATURE_FAMILY_CARD_IDS);
freezeGameContent(DAME_NATURE_QUIZ_CARD_IDS);
freezeGameContent(DAME_NATURE_NATURE_CARD_IDS);
