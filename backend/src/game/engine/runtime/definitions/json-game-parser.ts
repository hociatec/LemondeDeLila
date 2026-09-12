import { effectJsonDefinitions } from '../contracts/effect-json-schema';
import {
  assertAuthorJson,
  validateAuthorSchema,
} from '../contracts/json-author-schema';
import type { JsonGameDocument } from './json-game-document';
import { jsonGameSchema } from './json-game-schema';

export function parseJsonGame(
  value: unknown,
  path = 'game.json',
): JsonGameDocument {
  assertAuthorJson(value, path);
  validateAuthorSchema(value, jsonGameSchema, effectJsonDefinitions, path);
  // Only the boundary validated by the closed grammar above may narrow unknown.
  return structuredClone(value) as JsonGameDocument;
}
