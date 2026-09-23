import {
  assertAuthorJson,
  freezeAuthorSchema,
  validateAuthorSchema,
  type AuthorSchema,
} from './json-author-schema';
import { effectJsonDefinitions } from './effect-json-schema';

export type AuthorCodec<T> = Readonly<{
  schema: AuthorSchema;
  parse: (value: unknown, path?: string) => T;
}>;

/** The single narrowing boundary runs the closed grammar before returning typed data. */
export function createAuthorCodec<T>(schema: AuthorSchema): AuthorCodec<T> {
  const grammar = freezeAuthorSchema(structuredClone(schema));
  return Object.freeze({
    schema: grammar,
    parse(value: unknown, path = '$'): T {
      assertAuthorJson(value, path);
      validateAuthorSchema(value, grammar, effectJsonDefinitions, path);
      return structuredClone(value) as T;
    },
  });
}
