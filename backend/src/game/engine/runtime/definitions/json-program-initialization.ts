import type { JsonGameDocument } from './json-game-schema';
import type { JsonEngineExtensionCatalog } from '../contracts/json-engine-extension-catalog';

export function jsonProgramInitialization(
  document: JsonGameDocument,
  jsonEngineExtensions: JsonEngineExtensionCatalog = [],
) {
  if (Object.keys(document.setup).length === 0) return undefined;
  const sources = new Map<string, unknown>(Object.entries(document));
  if (
    !jsonEngineExtensions.some(
      (extension) => extension.ownsSetup && sources.has(extension.documentKey),
    )
  )
    return document.setup;
  return { ...document.setup, startRound: false };
}
