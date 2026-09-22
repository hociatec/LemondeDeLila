import { effectJsonDefinitions } from '../contracts/effect-json-schema';
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
  return structuredClone(value) as JsonGameDocument;
}
