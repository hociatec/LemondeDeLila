import type { GameState } from '../../../core/application/models/game-state.model';
import { GameStateViolationError } from '../../../core/domain/errors/game-domain.errors';
import type { DeclarativeState } from '../state/declarative-state';
import type { ContentSnapshotMigration } from './game-content';
import { canMigrateContentVersion } from './content-migration-registry';
import { GAME_ENGINE_ALGORITHM_VERSION } from './engine-algorithm-version';
import { migrateEngineSnapshot } from './engine-snapshot-migrations';
import {
  assertGameScheduler,
  SCHEDULED_TASK_SCHEMA_VERSION,
} from '../automation/scheduler-contracts';

export function loadDeclarativeState<TState extends object>(
  state: GameState,
  gameId: string,
  schemaVersion: number,
  contentVersion: string,
  rulesVersion: string,
  contentMigrations: readonly ContentSnapshotMigration[] = [],
  contentDigest?: string,
): DeclarativeState<TState> {
  const runtime = migrateEngineSnapshot(
    state,
    GAME_ENGINE_ALGORITHM_VERSION,
  ) as DeclarativeState<TState>;
  const storedSchemaVersion = runtime.engine.schemaVersion;
  const storedAlgorithmVersion = runtime.engine.algorithmVersion;
  const storedContentVersion = runtime.engine.contentVersion;
  const storedRulesVersion = runtime.engine.rulesVersion;
  const contentMigration =
    storedContentVersion !== contentVersion &&
    canMigrateContentVersion(
      storedContentVersion,
      contentVersion,
      contentMigrations,
    );

  if (
    storedSchemaVersion !== schemaVersion ||
    storedAlgorithmVersion !== GAME_ENGINE_ALGORITHM_VERSION ||
    (storedContentVersion !== contentVersion && !contentMigration) ||
    (contentDigest !== undefined &&
      runtime.engine.contentDigest !== contentDigest &&
      !contentMigration) ||
    storedRulesVersion !== rulesVersion
  ) {
    throw new GameStateViolationError(
      `État ${gameId} incompatible avec le runtime courant`,
      {
        gameId,
        storedSchemaVersion,
        storedAlgorithmVersion,
        schemaVersion,
        storedContentVersion,
        contentVersion,
        storedContentDigest: runtime.engine.contentDigest ?? null,
        contentDigest: contentDigest ?? null,
        storedRulesVersion,
        rulesVersion,
      },
    );
  }

  runtime.engine.contentVersion = contentVersion;
  if (contentDigest !== undefined) runtime.engine.contentDigest = contentDigest;
  runtime.engine.algorithmVersion = GAME_ENGINE_ALGORITHM_VERSION;

  assertGameScheduler(runtime.engine.scheduler);
  for (const task of Object.values(runtime.engine.scheduler.tasks)) {
    task.schemaVersion ??= SCHEDULED_TASK_SCHEMA_VERSION;
  }
  return runtime;
}
