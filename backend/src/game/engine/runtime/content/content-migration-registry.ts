import type { ContentSnapshotMigration } from './game-content';

const MAX_MIGRATION_STEPS = 64;

/** Resolves compatibility through the one runtime-owned migration graph. */
export function canMigrateContentVersion(
  fromVersion: string,
  toVersion: string,
  migrations: readonly ContentSnapshotMigration[],
): boolean {
  if (fromVersion === toVersion) return true;
  const nextByVersion = new Map<string, string[]>();
  for (const migration of migrations) {
    const next = nextByVersion.get(migration.fromVersion) ?? [];
    next.push(migration.toVersion);
    nextByVersion.set(migration.fromVersion, next);
  }

  const visited = new Set<string>([fromVersion]);
  const pending: Array<{ version: string; steps: number }> = [
    { version: fromVersion, steps: 0 },
  ];
  for (const current of pending) {
    if (current.steps >= MAX_MIGRATION_STEPS) continue;
    for (const nextVersion of nextByVersion.get(current.version) ?? []) {
      if (nextVersion === toVersion) return true;
      if (visited.has(nextVersion)) continue;
      visited.add(nextVersion);
      pending.push({ version: nextVersion, steps: current.steps + 1 });
    }
  }
  return false;
}
