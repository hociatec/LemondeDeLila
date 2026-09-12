import { cardAttributesSchema } from './json-card-selection-schema';
import {
  type AuthorSchema,
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorRef as ref,
} from '../contracts/json-author-schema';

const cardQuizSchema = object(
  {
    prompt: { type: 'string', minLength: 1, maxLength: 10000 },
    choices: array({ type: 'string', maxLength: 10000 }, 2),
    correctIndex: { type: 'integer', minimum: 0, maximum: 10000 },
    successDelta: { type: 'integer', minimum: -10000, maximum: 10000 },
    failureDelta: { type: 'integer', minimum: -10000, maximum: 10000 },
    anyCorrect: { type: 'boolean' },
  },
  ['prompt', 'choices', 'correctIndex', 'successDelta', 'failureDelta'],
);
const identifiedQuizSchema = object({
  choices: array(
    object({ id, label: { type: 'string', maxLength: 10000 } }),
    2,
  ),
  answerId: id,
  successDelta: { type: 'integer', minimum: -10000, maximum: 10000 },
});

export const jsonCardValueSchema: AuthorSchema = {
  oneOf: [
    id,
    { type: 'integer' },
    object(
      {
        id: { oneOf: [id, { type: 'integer' }] },
        localNumber: { type: 'integer', minimum: 0, maximum: 1000000 },
        category: { type: 'string', minLength: 1, maxLength: 128 },
        kind: { type: 'string', minLength: 1, maxLength: 128 },
        deck: id,
        points: { type: 'integer', minimum: -1000000, maximum: 1000000 },
        retreatScore: {
          type: 'integer',
          minimum: -1000000,
          maximum: 1000000,
        },
        label: { type: 'string' },
        title: { type: 'string' },
        prompt: { type: 'string', maxLength: 10000 },
        choices: array({ type: 'string', maxLength: 10000 }, 2),
        correctIndex: { type: 'integer', minimum: 0, maximum: 10000 },
        correctDelta: { type: 'integer', minimum: -10000, maximum: 10000 },
        wrongDelta: { type: 'integer', minimum: -10000, maximum: 10000 },
        moveDelta: { type: 'integer', minimum: -10000, maximum: 10000 },
        quiz: { oneOf: [cardQuizSchema, identifiedQuizSchema] },
        text: { type: 'string', maxLength: 10000 },
        effect: { type: 'string', maxLength: 10000 },
        description: { type: 'string', maxLength: 10000 },
        name: { type: 'string', maxLength: 10000 },
        effectDescription: { type: 'string' },
        collectionGain: {
          oneOf: [
            { type: 'null' },
            { type: 'string', minLength: 1, maxLength: 128 },
          ],
        },
        discardAfterResolve: { type: 'boolean' },
        attributes: cardAttributesSchema,
        effects: array(ref('effect')),
        moveDeltas: array({ type: 'integer', minimum: -10000, maximum: 10000 }),
      },
      ['id'],
    ),
  ],
};
