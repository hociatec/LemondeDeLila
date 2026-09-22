import type { JsonGameDocument } from './json-game-schema';
import type { JsonEffectPackCatalog } from '../contracts/json-effect-pack-catalog';

export function jsonProgramInitialization(
  document: JsonGameDocument,
  jsonEffectPacks: JsonEffectPackCatalog = [],
) {
  if (Object.keys(document.setup).length === 0) return undefined;
  const sources = new Map<string, unknown>(Object.entries(document));
  if (
    !jsonEffectPacks.some(
      (extension) => extension.ownsSetup && sources.has(extension.documentKey),
    )
  )
    return document.setup;
  return { ...document.setup, startRound: false };
}
