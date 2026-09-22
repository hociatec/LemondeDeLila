import { standardVictorySchemas } from './json-standard-victory';
import {
  type AuthorSchema,
  authorId as id,
  authorObject as object,
} from '../contracts/json-author-schema';

const options = {
  participants: { enum: ['active', 'all'] },
  selection: {
    enum: ['all-qualified', 'unique-qualified', 'highest-value-lowest-id'],
  },
  reason: { type: 'string', minLength: 1, maxLength: 128 },
} satisfies Record<string, AuthorSchema>;

export const createJsonVictorySchema = (
  programKinds: readonly string[] = [],
): AuthorSchema => ({
  oneOf: [
    ...programKinds.map((kind) => object({ kind: { const: kind } })),
    ...standardVictorySchemas,
    object(
      {
        kind: { const: 'resource-at-least' },
        resource: id,
        amount: { type: 'number', minimum: 1 },
        ...options,
      },
      ['kind', 'resource', 'amount'],
    ),
    object(
      {
        kind: { const: 'score-at-least' },
        amount: { type: 'number', minimum: 1 },
        ...options,
      },
      ['kind', 'amount'],
    ),
  ],
});
export const jsonVictorySchema = createJsonVictorySchema();
