import { effectJsonDefinitions } from '../contracts/effect-json-schema';
import { AuthoringError } from '../contracts/authoring-error';
import {
  assertAuthorJson,
  validateAuthorSchema,
} from '../contracts/json-author-schema';
import type { JsonGameDocument } from './json-game-document';
import type { AuthorSchema } from '../contracts/json-author-schema';
import { jsonGameSchema } from './json-game-schema';

export function parseJsonGame(
  value: unknown,
  path = 'game.json',
  schema: AuthorSchema = jsonGameSchema,
): JsonGameDocument {
  assertAuthorJson(value, path);
  validateAuthorSchema(value, schema, effectJsonDefinitions, path);
  // Only the boundary validated by the closed grammar above may narrow unknown.
  const document = structuredClone(value) as JsonGameDocument;
  if (!Object.hasOwn(document, 'extensions')) return document;
  // The catalogue-generated schema above validated each discriminated config.
  const { extensions } = document;
  const normalized: Record<string, unknown> = { ...document };
  delete normalized.extensions;
  for (const [index, extension] of (
    extensions as readonly {
      type: string;
      config: unknown;
    }[]
  ).entries()) {
    if (Object.hasOwn(normalized, extension.type))
      throw new AuthoringError(
        `${path}.extensions[${index}].type`,
        'unique extension type',
        extension.type,
        `duplicate extension ${extension.type}`,
      );
    normalized[extension.type] = extension.config;
  }
  return normalized as JsonGameDocument;
}
