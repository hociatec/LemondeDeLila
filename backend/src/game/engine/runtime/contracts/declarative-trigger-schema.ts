import {
  authorArray,
  authorId,
  authorObject,
  authorRecord,
  authorRef,
  type AuthorSchema,
} from './json-author-schema';

export const declarativeTriggerFields = {
  id: authorId,
  on: {
    oneOf: [
      authorObject({ kind: { const: 'action' }, type: authorId }),
      authorObject(
        {
          kind: { const: 'event' },
          type: authorId,
          equals: authorRecord({
            oneOf: [
              { type: 'string', maxLength: 256 },
              { type: 'number' },
              { type: 'boolean' },
            ],
          }),
        },
        ['kind', 'type'],
      ),
    ],
  },
  condition: authorRef('condition'),
  effects: authorArray(authorRef('effect'), 1),
} satisfies Record<string, AuthorSchema>;
export const declarativeTriggerSchema = authorObject(declarativeTriggerFields, [
  'id',
  'on',
  'effects',
]);
