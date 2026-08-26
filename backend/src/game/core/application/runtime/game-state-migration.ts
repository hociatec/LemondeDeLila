import { GameStateViolationError } from '../../domain/errors/game-domain.errors';
import type { GameStateEntity } from '../models/game-state.model';
import type {
  DeclarativeState,
  GameStateMigration,
} from './game-definition';
import {
  createGameConfigurationState,
  type GameConfigurationShape,
} from './configuration-kit';
import { createEffectEngineState } from './effects-kit';
import { createGameCommandJournalState } from './game-command-journal';
import { createSubmissionKitState } from './submission-kit';
import { createGameSchedulerState } from './scheduler-kit';

export function migrateDeclarativeState<TState extends object>(
  state: GameStateEntity,
  gameId: string,
  targetVersion: number,
  targetRulesVersion: string,
  migrations: readonly GameStateMigration<TState>[],
  configuration: GameConfigurationShape<TState> | undefined,
): DeclarativeState<TState> {
  const runtime = structuredClone(state) as DeclarativeState<TState>;
  const versionedEngine = runtime.engine as Omit<
    DeclarativeState<TState>['engine'],
    'schemaVersion' | 'rulesVersion'
  > & {
    schemaVersion?: number;
    rulesVersion?: string;
  };
  let version = Number(versionedEngine.schemaVersion ?? 1);
  if (!Number.isInteger(version) || version < 1) version = 1;
  if (version > targetVersion) {
    throw new GameStateViolationError(
      `État ${gameId} plus récent que le runtime`,
      { gameId, stateVersion: version, targetVersion },
    );
  }
  const storedRulesVersion = versionedEngine.rulesVersion;
  if (
    typeof storedRulesVersion === 'string' &&
    storedRulesVersion !== targetRulesVersion
  ) {
    throw new GameStateViolationError(
      `Version de règles indisponible pour ${gameId}`,
      {
        gameId,
        storedRulesVersion,
        targetRulesVersion,
      },
    );
  }

  while (version < targetVersion) {
    const migration = migrations.find((candidate) => candidate.from === version);
    if (!migration || migration.to <= version) {
      throw new GameStateViolationError(
        `Migration d’état manquante pour ${gameId}`,
        { gameId, fromVersion: version, targetVersion },
      );
    }
    runtime.game = migration.migrate(structuredClone(runtime.game));
    version = migration.to;
  }
  runtime.engine.schemaVersion = version;
  runtime.engine.rulesVersion = storedRulesVersion ?? targetRulesVersion;
  runtime.engine.configuration ??= createGameConfigurationState(
    configuration as GameConfigurationShape<object> | undefined,
    runtime.players ?? [],
    runtime.metadata?.ownerPlayerId ?? runtime.metadata?.roomOwnerId,
  );
  runtime.engine.effects ??= createEffectEngineState();
  runtime.engine.effects.awaitingReaction ??= null;
  runtime.engine.effects.awaitingPlayerChoice ??= null;
  runtime.engine.effects.playerChoiceResolved ??=
    runtime.engine.effects.chosenPlayerId != null;
  runtime.engine.effects.resolvedPlayerChoiceId ??=
    runtime.engine.effects.playerChoiceResolved
      ? runtime.engine.effects.awaitingChoiceId
      : null;
  runtime.engine.effects.completeTurnWhenDrained ??= false;
  runtime.engine.commands ??= createGameCommandJournalState();
  runtime.engine.submissions ??= createSubmissionKitState();
  runtime.engine.scheduler ??= createGameSchedulerState();
  runtime.engine.submissions.judges ??= {};
  runtime.engine.kits ??= {};
  if (runtime.engine.kits.cards) {
    runtime.engine.kits.cards.deckLifecycles ??= {};
    runtime.engine.kits.cards.completedSets ??= {};
  }
  if (runtime.engine.kits.quiz) {
    runtime.engine.kits.quiz.sessions ??= {};
    runtime.engine.kits.quiz.sequence ??= 0;
  }
  const legacyEngine = runtime.engine as DeclarativeState<TState>['engine'] & {
    version?: unknown;
    status?: unknown;
    players?: unknown;
    turn?: unknown;
    phase?: unknown;
    pending?: unknown;
    rng?: unknown;
    eventSequence?: unknown;
  };
  delete legacyEngine.version;
  delete legacyEngine.status;
  delete legacyEngine.players;
  delete legacyEngine.turn;
  delete legacyEngine.phase;
  delete legacyEngine.pending;
  delete legacyEngine.rng;
  delete legacyEngine.eventSequence;
  stripLegacyStaticKitDefinitions(runtime.engine.kits);
  return runtime;
}

function stripLegacyStaticKitDefinitions(
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
    const state = kits[kit as keyof typeof kits] as unknown as
      | Record<string, unknown>
      | undefined;
    if (!state) continue;
    for (const field of fields) delete state[field];
  }
}
