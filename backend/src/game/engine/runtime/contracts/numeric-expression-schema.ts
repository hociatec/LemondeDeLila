import {
  type AuthorSchema,
  authorNumber,
  authorId,
  authorObject,
  authorRef,
} from './json-author-schema';

const value = authorRef('numeric-expression');
const variant = (
  kind: string,
  fields: Record<string, AuthorSchema> = {},
  required = Object.keys(fields),
) => authorObject({ kind: { const: kind }, ...fields }, ['kind', ...required]);

export const numericExpressionSchema = {
  oneOf: [
    authorNumber,
    variant('resource-value', { resource: authorId }),
    variant('score-value'),
    variant('track-value', { trackId: authorId }),
    variant('inventory-size', { inventoryId: authorId, itemId: authorId }, [
      'inventoryId',
    ]),
    variant('hand-size', { handId: authorId }),
    variant('player-count', { participants: { enum: ['active', 'all'] } }),
    ...['add', 'subtract', 'multiply', 'divide', 'min', 'max'].map((kind) =>
      variant(kind, { left: value, right: value }),
    ),
    variant('clamp', { value, min: value, max: value }),
  ],
} satisfies AuthorSchema;
