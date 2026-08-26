import data from './content-data.json';

export type LaGrandeMineCategory =
  | 'tresor'
  | 'objet'
  | 'event'
  | 'monster'
  | 'collapse';

export interface LaGrandeMineCard {
  id: string;
  name: string;
  category: LaGrandeMineCategory;
  description: string;
  points?: number | null;
}

const categories: LaGrandeMineCategory[] = [
  'tresor',
  'objet',
  'event',
  'monster',
  'collapse',
];

export const LA_GRANDE_MINE_CARDS: LaGrandeMineCard[] = data.cards.map(
  (card) => ({ ...card, category: category(card.category) }),
);
export const LA_GRANDE_MINE_CARD_BY_ID = Object.fromEntries(
  LA_GRANDE_MINE_CARDS.map((card) => [card.id, card]),
);

function category(value: string): LaGrandeMineCategory {
  const found = categories.find((candidate) => candidate === value);
  if (!found) throw new Error(`Catégorie Grande Mine inconnue: ${value}`);
  return found;
}
