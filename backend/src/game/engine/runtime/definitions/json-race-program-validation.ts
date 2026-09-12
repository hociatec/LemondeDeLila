import type { GamePattern } from '../contracts/pattern-definition';
import type { JsonGameDocument } from './json-game-schema';
import { assertEventRaceReferences } from './json-event-race-schema';
import { assertDeliveryRaceReferences } from './json-delivery-race-schema';
import { assertGooseRaceReferences } from './json-goose-race-schema';
import { assertCollectionRaceReferences } from './json-collection-race-schema';
import { assertEcosystemRaceReferences } from './json-ecosystem-race-schema';
import { assertPirateRaceReferences } from './json-pirate-race-schema';

type Failure = (path: string, reason: string) => never;
type Patterns = readonly GamePattern<Record<string, never>>[] | undefined;

export function assertJsonRacePrograms(
  document: JsonGameDocument,
  patterns: Patterns,
  maxPlayers: number,
  fail: Failure,
): void {
  assertEventRace(document, patterns, maxPlayers, fail);
  assertDeliveryRace(document, patterns, fail);
  assertGooseRace(document, patterns, maxPlayers, fail);
  assertCollectionRace(document, patterns, fail);
  assertEcosystemRace(document, patterns, fail);
  assertPirateRace(document, patterns, fail);
}

function assertPirateRace(
  document: JsonGameDocument,
  patterns: Patterns,
  fail: Failure,
): void {
  if (
    (document.victory.kind === 'by-pirate-race') !==
    Boolean(document.pirateRace)
  )
    fail('victory', 'pirate race program and victory required together');
  if (!document.pirateRace) return;
  if (
    !(document.patterns ?? []).some(
      (pattern) =>
        pattern.kind === 'race' &&
        pattern.trackId === document.pirateRace?.trackId,
    )
  )
    fail('patterns', 'pirate race requires its declared race track');
  assertPirateRaceReferences(
    document.pirateRace,
    components(document, patterns),
    new Set(document.resourceIds),
  );
}

function components(document: JsonGameDocument, patterns: Patterns) {
  return [
    ...document.components,
    ...(patterns ?? []).flatMap((pattern) => pattern.components ?? []),
  ];
}

function assertEventRace(
  document: JsonGameDocument,
  patterns: Patterns,
  maxPlayers: number,
  fail: Failure,
): void {
  if (
    (document.victory.kind === 'by-event-race') !==
    Boolean(document.eventRace)
  )
    fail('victory', 'event race program and victory required together');
  if (!document.eventRace) return;
  if (
    !(document.patterns ?? []).some(
      (pattern) =>
        pattern.kind === 'race' &&
        pattern.trackId === document.eventRace?.trackId &&
        pattern.winOnFinish,
    )
  )
    fail('patterns', 'event race requires a race with finish victory');
  assertEventRaceReferences(
    document.eventRace,
    components(document, patterns),
    document.phases,
    document.initialPhase,
    maxPlayers,
  );
}

function assertDeliveryRace(
  document: JsonGameDocument,
  patterns: Patterns,
  fail: Failure,
): void {
  if (
    (document.victory.kind === 'by-delivery-race') !==
    Boolean(document.deliveryRace)
  )
    fail('victory', 'delivery race program and victory required together');
  if (!document.deliveryRace) return;
  if (
    !(document.patterns ?? []).some(
      (pattern) =>
        pattern.kind === 'race' &&
        pattern.trackId === document.deliveryRace?.trackId,
    )
  )
    fail('patterns', 'delivery race requires its declared race track');
  assertDeliveryRaceReferences(
    document.deliveryRace,
    components(document, patterns),
  );
}

function assertGooseRace(
  document: JsonGameDocument,
  patterns: Patterns,
  maxPlayers: number,
  fail: Failure,
): void {
  if (
    (document.victory.kind === 'by-goose-race') !==
    Boolean(document.gooseRace)
  )
    fail('victory', 'goose race program and victory required together');
  if (!document.gooseRace) return;
  if (
    !(document.patterns ?? []).some(
      (pattern) =>
        pattern.kind === 'race' &&
        pattern.trackId === document.gooseRace?.trackId,
    )
  )
    fail('patterns', 'goose race requires its declared race track');
  assertGooseRaceReferences(
    document.gooseRace,
    components(document, patterns),
    document.phases,
    maxPlayers,
  );
}

function assertCollectionRace(
  document: JsonGameDocument,
  patterns: Patterns,
  fail: Failure,
): void {
  if (
    (document.victory.kind === 'by-collection-race') !==
    Boolean(document.collectionRace)
  )
    fail('victory', 'collection race program and victory required together');
  if (!document.collectionRace) return;
  if (
    !(document.patterns ?? []).some(
      (pattern) =>
        pattern.kind === 'race' &&
        pattern.trackId === document.collectionRace?.trackId,
    )
  )
    fail('patterns', 'collection race requires its declared race track');
  assertCollectionRaceReferences(
    document.collectionRace,
    components(document, patterns),
    new Set(document.resourceIds),
  );
}

function assertEcosystemRace(
  document: JsonGameDocument,
  patterns: Patterns,
  fail: Failure,
): void {
  if (
    (document.victory.kind === 'by-ecosystem-race') !==
    Boolean(document.ecosystemRace)
  )
    fail('victory', 'ecosystem race program and victory required together');
  if (!document.ecosystemRace) return;
  if (
    !(document.patterns ?? []).some(
      (pattern) =>
        pattern.kind === 'race' &&
        pattern.trackId === document.ecosystemRace?.trackId,
    )
  )
    fail('patterns', 'ecosystem race requires its declared race track');
  assertEcosystemRaceReferences(
    document.ecosystemRace,
    components(document, patterns),
    new Set(document.resourceIds),
    new Set(Object.keys(document.setup.counters ?? {})),
  );
}
