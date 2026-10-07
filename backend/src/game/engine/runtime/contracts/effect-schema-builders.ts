import {
  type AuthorSchema,
  authorObject,
  authorRef,
  authorId,
  authorInteger,
} from './json-author-schema';

export const cardLocationSchema: AuthorSchema = {
  oneOf: [
    effectVariant('deck', { deckId: authorId }),
    effectVariant('discard', { deckId: authorId }),
    effectVariant('hand', { handId: authorId, playerId: authorInteger }),
    effectVariant('zone', { zoneId: authorId }),
  ],
};

export function effectVariant(
  kind: string,
  fields: Record<string, AuthorSchema> = {},
  required = Object.keys(fields),
): AuthorSchema {
  return authorObject({ kind: { const: kind }, ...fields }, [
    'kind',
    ...required,
  ]);
}

export function targetedEffectVariant(
  kind: string,
  fields: Record<string, AuthorSchema>,
  required = Object.keys(fields),
): AuthorSchema {
  return effectVariant(
    kind,
    { ...fields, target: authorRef('target') },
    required,
  );
}
