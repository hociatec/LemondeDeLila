import {
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorRef as ref,
} from '../contracts/json-author-schema';
const text = { type: 'string', minLength: 1, maxLength: 10000 } as const;
export const familyEffectsPatternSchema = object({
  kind: { const: 'family-effects' },
  requestRecipe: id,
  requestAction: id,
  deckId: id,
  handId: id,
  setsId: id,
  cards: array(
    object(
      {
        id,
        name: text,
        description: text,
        type: { enum: ['metier', 'special'] },
        family: id,
        effects: array(ref('effect')),
      },
      ['id', 'name', 'type', 'effects'],
    ),
    1,
  ),
  familyIds: array(id, 1),
  extraDrawResource: id,
  freeRequestStatus: id,
  vanishedStatus: id,
  finishReason: id,
  eventNamespace: id,
});
