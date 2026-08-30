import { GameStateViolationError } from '../../../core/domain/errors/game-domain.errors';
import type { GameStateEntity } from '../../../core/application/contracts/game-state.model';
import type {
  DeclarativeState,
  GameContentMigration,
  GameStateMigration,
} from '../definitions/game-definition';
import {
  createGameConfigurationState,
  type GameConfigurationShape,
} from '../configuration/configuration-kit';
import { createEffectEngineState } from '../effects/effects-kit';
import { createGameCommandJournalState } from '../actions/game-command-journal';
import { createSubmissionKitState } from '../submissions/submission-kit';
import { createGameSchedulerState } from '../automation/scheduler-kit';

export function migrateDeclarativeState<TState extends object>(
  state: GameStateEntity,
  gameId: string,
  targetVersion: number,
  targetContentVersion: string,
  targetRulesVersion: string,
  migrations: readonly GameStateMigration<TState>[],
  contentMigrations: readonly GameContentMigration<TState>[],
  configuration: GameConfigurationShape<TState> | undefined,
): DeclarativeState<TState> {
  const runtime = structuredClone(state) as DeclarativeState<TState>;
  let version = Number(runtime.engine.schemaVersion ?? 1);
  if (!Number.isInteger(version) || version < 1) version = 1;
  assertCompatibleSchemaVersion(gameId, version, targetVersion);
  const storedRulesVersion = runtime.engine.rulesVersion;
  const storedContentVersion = runtime.engine.contentVersion;
  if (typeof storedContentVersion === 'string') {
    migrateContentVersion(
      runtime,
      gameId,
      storedContentVersion,
      targetContentVersion,
      contentMigrations,
    );
  }
  assertCompatibleRulesVersion(gameId, storedRulesVersion, targetRulesVersion);
  version = applyStateMigrations(
    runtime,
    gameId,
    version,
    targetVersion,
    migrations,
  );
  runtime.engine.schemaVersion = version;
  runtime.engine.contentVersion = targetContentVersion;
  runtime.engine.rulesVersion = storedRulesVersion ?? targetRulesVersion;
  normalizeEngineState(runtime, configuration);
  removeObsoleteEngineFields(runtime);
  stripObsoleteStaticKitDefinitions(runtime.engine.kits);
  return runtime;
}

function normalizeEngineState<TState extends object>(
  runtime: DeclarativeState<TState>,
  configuration: GameConfigurationShape<TState> | undefined,
): void {
  runtime.engine.configuration ??= createGameConfigurationState(
    configuration as GameConfigurationShape<object> | undefined,
    runtime.players ?? [],
    runtime.metadata?.ownerPlayerId ?? runtime.metadata?.roomOwnerId,
  );
  runtime.engine.effects ??= createEffectEngineState();
  runtime.engine.effects.schemaVersion ??= 1;
  runtime.engine.effects.awaitingReaction ??= null;
  runtime.engine.effects.awaitingPlayerChoice ??= null;
  runtime.engine.effects.playerChoiceResolved ??=
    runtime.engine.effects.chosenPlayerId != null;
  runtime.engine.effects.resolvedPlayerChoiceId ??= runtime.engine.effects
    .playerChoiceResolved
    ? runtime.engine.effects.awaitingChoiceId
    : null;
  runtime.engine.effects.completeTurnWhenDrained ??= false;
  runtime.engine.commands ??= createGameCommandJournalState();
  runtime.engine.submissions ??= createSubmissionKitState();
  runtime.engine.scheduler ??= createGameSchedulerState();
  runtime.engine.submissions.judges ??= {};
  runtime.engine.kits ??= {};
  migratePendingChoice(runtime.pending);
  normalizeCardsState(runtime.engine.kits.cards);
  if (runtime.engine.kits.quiz) {
    runtime.engine.kits.quiz.sessions ??= {};
    runtime.engine.kits.quiz.sequence ??= 0;
  }
  if (runtime.engine.kits.dice) {
    runtime.engine.kits.dice.rollsByPlayer ??= {};
  }
  if (runtime.engine.kits.grid) {
    runtime.engine.kits.grid.overlays ??= {};
  }
}

function removeObsoleteEngineFields<TState extends object>(
  runtime: DeclarativeState<TState>,
): void {
  const obsoleteEngineFields =
    runtime.engine as DeclarativeState<TState>['engine'] & {
      version?: unknown;
      status?: unknown;
      players?: unknown;
      turn?: unknown;
      phase?: unknown;
      pending?: unknown;
      rng?: unknown;
      eventSequence?: unknown;
    };
  delete obsoleteEngineFields.version;
  delete obsoleteEngineFields.status;
  delete obsoleteEngineFields.players;
  delete obsoleteEngineFields.turn;
  delete obsoleteEngineFields.phase;
  delete obsoleteEngineFields.pending;
  delete obsoleteEngineFields.rng;
  delete obsoleteEngineFields.eventSequence;
}

function assertCompatibleSchemaVersion(
  gameId: string,
  version: number,
  targetVersion: number,
): void {
  if (version <= targetVersion) return;
  throw new GameStateViolationError(
    `État ${gameId} plus récent que le runtime`,
    {
      gameId,
      stateVersion: version,
      targetVersion,
    },
  );
}

function assertCompatibleRulesVersion(
  gameId: string,
  storedRulesVersion: string | undefined,
  targetRulesVersion: string,
): void {
  if (storedRulesVersion == null || storedRulesVersion === targetRulesVersion)
    return;
  throw new GameStateViolationError(
    `Version de règles indisponible pour ${gameId}`,
    {
      gameId,
      storedRulesVersion,
      targetRulesVersion,
    },
  );
}

function applyStateMigrations<TState extends object>(
  runtime: DeclarativeState<TState>,
  gameId: string,
  from: number,
  target: number,
  migrations: readonly GameStateMigration<TState>[],
): number {
  let version = from;
  while (version < target) {
    const migration = migrations.find(
      (candidate) => candidate.from === version,
    );
    if (!migration || migration.to <= version) {
      throw new GameStateViolationError(
        `Migration d’état manquante pour ${gameId}`,
        {
          gameId,
          fromVersion: version,
          targetVersion: target,
        },
      );
    }
    runtime.game = migration.migrate(structuredClone(runtime.game));
    version = migration.to;
  }
  return version;
}

function migrateContentVersion<TState extends object>(
  runtime: DeclarativeState<TState>,
  gameId: string,
  from: string,
  target: string,
  migrations: readonly GameContentMigration<TState>[],
): void {
  let version = from;
  const visited = new Set<string>();
  while (version !== target) {
    if (visited.has(version)) break;
    visited.add(version);
    const migration = migrations.find(
      (candidate) => candidate.from === version,
    );
    if (!migration) break;
    migration.migrate(runtime);
    version = migration.to;
  }
  if (version !== target) {
    throw new GameStateViolationError(
      `Version de contenu indisponible pour ${gameId}`,
      { gameId, storedContentVersion: from, targetContentVersion: target },
    );
  }
}

function migratePendingChoice(pending: GameStateEntity['pending']): void {
  if (!pending) return;
  pending.schemaVersion ??= 1;
  for (const queued of pending.queue ?? []) migratePendingChoice(queued);
}

function normalizeCardsState(
  cards: DeclarativeState<object>['engine']['kits']['cards'],
): void {
  if (!cards) return;
  cards.deckLifecycles ??= {};
  cards.zones ??= {};
  cards.completedSets ??= {};
}

function stripObsoleteStaticKitDefinitions(
  kits: DeclarativeState<object>['engine']['kits'],
): void {
  for (const [kit, fields] of Object.entries({
    cards: ['handDefinitions', 'setDefinitions'],
    inventory: ['definitions'],
    economy: ['definitions'],
    ownership: ['definitions'],
    movement: ['tracks'],
    pawns: ['sets'],
    dice: ['sets'],
    grid: ['boards'],
  })) {
    const state = kits[kit as keyof typeof kits];
    if (!state) continue;
    for (const field of fields) Reflect.deleteProperty(state, field);
  }
}
