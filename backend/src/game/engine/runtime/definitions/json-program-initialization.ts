import type { JsonGameDocument } from './json-game-schema';
import { jsonProgramExtensions } from '../extensions/json-program-extension-registry';

export function jsonProgramInitialization(document: JsonGameDocument) {
  if (Object.keys(document.setup).length === 0) return undefined;
  const sources = new Map<string, unknown>(Object.entries(document));
  if (
    !jsonProgramExtensions.some(
      (extension) => extension.ownsSetup && sources.has(extension.documentKey),
    )
  )
    return document.setup;
  return { ...document.setup, startRound: false };
}
