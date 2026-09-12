import type { JsonGameDocument } from './json-game-schema';

export function jsonProgramInitialization(document: JsonGameDocument) {
  if (Object.keys(document.setup).length === 0) return undefined;
  if (!document.board && !document.judgedCards && !document.eventRace)
    return document.setup;
  return { ...document.setup, startRound: false };
}
