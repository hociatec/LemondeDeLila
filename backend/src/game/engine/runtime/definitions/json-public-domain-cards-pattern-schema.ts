import {
  authorArray as array,
  authorId as id,
  authorInteger as integer,
  authorObject as object,
  authorPositive as positive,
  authorRef as ref,
} from '../contracts/json-author-schema';

export const publicDomainCardsPatternSchema = object({
  kind: { const: 'public-domain-cards' },
  playRecipe: id,
  passRecipe: id,
  collectibleCategories: array(id, 1),
  lossCategory: id,
  deckId: id,
  handId: id,
  inventoryId: id,
  discardNextDrawStatus: id,
  handLimit: positive,
  finishReason: id,
  eventNamespace: id,
  cards: array(
    object({
      id,
      name: { type: 'string', minLength: 1, maxLength: 2000 },
      category: id,
      description: { type: 'string', maxLength: 10000 },
      points: { oneOf: [integer, { type: 'null' }] },
      effects: array(ref('effect')),
    }),
    1,
  ),
});
