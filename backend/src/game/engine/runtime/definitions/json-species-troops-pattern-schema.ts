import {
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
  authorRef as ref,
} from '../contracts/json-author-schema';
export const speciesTroopsPatternSchema = object({
  kind: { const: 'species-troops' },
  playRecipe: id,
  passRecipe: id,
  playAction: id,
  passAction: id,
  deckId: id,
  handId: id,
  inventoryId: id,
  exchangeChoiceId: id,
  handLimit: positive,
  victoryReason: id,
  species: array(id, 1),
  cards: array(
    object(
      {
        id,
        name: { type: 'string', minLength: 1, maxLength: 1000 },
        description: { type: 'string', minLength: 1, maxLength: 10000 },
        type: { enum: ['monkey', 'action', 'trap', 'joker'] },
        species: id,
        action: id,
        trap: id,
        effects: array(ref('effect')),
      },
      ['id', 'name', 'type', 'effects'],
    ),
    1,
  ),
});
