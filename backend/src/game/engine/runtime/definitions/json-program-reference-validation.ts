import type { GamePattern } from '../contracts/pattern-definition';
import { jsonProgramExtensions } from '../extensions/json-program-extension-registry';
import type { JsonGameManifest } from './json-game-manifest';
import type { JsonGameDocument } from './json-game-schema';

type JsonFailure = (path: string, reason: string) => never;
type Patterns = readonly GamePattern<Record<string, never>>[] | undefined;

export function assertProgramReferences(
  document: JsonGameDocument,
  patterns: Patterns,
  manifest: JsonGameManifest,
  fail: JsonFailure,
): void {
  const sources = new Map<string, unknown>(Object.entries(document));
  const active = jsonProgramExtensions.filter((extension) =>
    sources.has(extension.documentKey),
  );
  if (active.length > 1) fail('programs', 'one game program per definition');

  const allPatterns = patterns ?? [];
  const components = [
    ...document.components,
    ...allPatterns.flatMap((pattern) => pattern.components ?? []),
  ];
  const resources = new Set([
    ...document.resourceIds,
    ...allPatterns.flatMap((pattern) => pattern.resourceIds ?? []),
  ]);
  const counters = new Set([
    ...Object.keys(document.setup.counters ?? {}),
    ...allPatterns.flatMap((pattern) =>
      Object.keys(pattern.initialization?.counters ?? {}),
    ),
  ]);
  const context = {
    document,
    patterns: allPatterns,
    components,
    resources,
    counters,
    minimumPlayers: manifest.minPlayers,
    maximumPlayers: manifest.maxPlayers,
    gameId: manifest.code,
    fail,
    hasRaceTrack: (trackId: string, winOnFinish = false) =>
      (document.patterns ?? []).some(
        (pattern) =>
          pattern.kind === 'race' &&
          pattern.trackId === trackId &&
          (!winOnFinish || Boolean(pattern.winOnFinish)),
      ),
  };
  for (const extension of jsonProgramExtensions) {
    const source = sources.get(extension.documentKey);
    const enabled = source !== undefined;
    if (
      extension.victoryKind &&
      (document.victory.kind === extension.victoryKind) !== enabled
    )
      fail(
        'victory',
        `${extension.victoryLabel ?? extension.documentKey} program and victory required together`,
      );
    if (enabled) extension.validateUnknown(context, source);
  }
}
