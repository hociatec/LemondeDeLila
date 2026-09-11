import type { GameState } from '../../../core/application/models/game-state.model';
import { GameStateViolationError } from '../../../core/domain/errors/game-domain.errors';
import { assertSerializableState } from '../state/assert-serializable-state';

export type EngineSnapshot = GameState & {
  engine: { algorithmVersion?: string; [key: string]: unknown };
};

export type EngineSnapshotMigration = {
  from: string;
  to: string;
  /** Synchronous, deterministic engine-owned transformation of an isolated clone. */
  transform(snapshot: EngineSnapshot): void;
};

/** Snapshots predating explicit algorithm headers were written by engine 1. */
export const LEGACY_ENGINE_ALGORITHM_VERSION = '1';

/** Add a reviewed transformation here when changing the engine algorithm version. */
export const ENGINE_SNAPSHOT_MIGRATIONS: readonly EngineSnapshotMigration[] =
  Object.freeze([]);

/** Exactly one outgoing migration per version; no ambiguous paths or implicit upgrade. */
export function migrateEngineSnapshot(
  source: GameState,
  targetVersion: string,
  migrations: readonly EngineSnapshotMigration[] = ENGINE_SNAPSHOT_MIGRATIONS,
): EngineSnapshot {
  const fail = (reason: string): never => {
    throw new GameStateViolationError(
      `Snapshot incompatible avec le runtime courant: ${reason}`,
    );
  };
  assertSerializableState(source);
  if (
    !source ||
    typeof source !== 'object' ||
    !('engine' in source) ||
    !source.engine ||
    typeof source.engine !== 'object' ||
    Array.isArray(source.engine)
  ) {
    throw new GameStateViolationError('Snapshot de jeu sans en-tete moteur');
  }
  const next = new Map<string, EngineSnapshotMigration>();
  for (const migration of migrations) {
    if (
      !migration.from.trim() ||
      !migration.to.trim() ||
      migration.from === migration.to ||
      next.has(migration.from)
    ) {
      fail('graphe de migration ambigu ou invalide');
    }
    next.set(migration.from, migration);
  }
  const snapshot = structuredClone(source) as EngineSnapshot;
  let current =
    snapshot.engine.algorithmVersion ?? LEGACY_ENGINE_ALGORITHM_VERSION;
  const visited = new Set<string>();
  const path: EngineSnapshotMigration[] = [];
  while (current !== targetVersion) {
    if (visited.has(current) || path.length >= 64)
      fail('cycle ou chaîne de migration trop longue');
    visited.add(current);
    const migration = next.get(current);
    if (!migration)
      return fail(`migration absente depuis ${current} vers ${targetVersion}`);
    path.push(migration);
    current = migration.to;
  }
  // Resolve the entire path before any transformation runs.
  for (const migration of path) {
    const identity = contentIdentity(snapshot);
    try {
      const result: unknown = migration.transform(snapshot);
      if (result !== undefined)
        return fail('une migration doit être synchrone et ne rien retourner');
    } catch (error) {
      return fail(
        `échec ${migration.from} -> ${migration.to}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    assertSerializableState(snapshot);
    if (
      !snapshot.engine ||
      Object.entries(identity).some(
        ([key, value]) => snapshot.engine[key] !== value,
      )
    ) {
      fail(
        'une migration moteur ne peut pas changer les versions de définition ou de contenu',
      );
    }
    snapshot.engine.algorithmVersion = migration.to;
  }
  snapshot.engine.algorithmVersion = targetVersion;
  return snapshot;
}

function contentIdentity(snapshot: EngineSnapshot) {
  const { schemaVersion, contentVersion, contentDigest, rulesVersion } =
    snapshot.engine;
  return { schemaVersion, contentVersion, contentDigest, rulesVersion };
}
