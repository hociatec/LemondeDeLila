import type { GameClock } from '../models/game-execution-context.model';
import type { GameStateEntity } from '../models/game-state.model';
import type { DeclarativeState } from './game-definition';
import { createMatchKitState } from './match-kit';
import { createPlayerValuesKitState } from './player-values-kit';
import { createRoundKitState } from './round-kit';
import {
  createGameConfigurationState,
  type GameConfigurationShape,
} from './configuration-kit';
import { createEffectEngineState } from './effects-kit';
import { createGameCommandJournalState } from './game-command-journal';
import { createSubmissionKitState } from './submission-kit';
import { createGameSchedulerState } from './scheduler-kit';

export function createDeclarativeState<TState extends object>(
  base: GameStateEntity,
  phase: string,
  turn: NonNullable<GameStateEntity['turn']>,
  clock: GameClock,
  schemaVersion: number,
  contentVersion: string,
  rulesVersion: string,
  configuration: GameConfigurationShape<TState> | undefined,
): DeclarativeState<TState> {
  const players = structuredClone(base.players ?? []);
  return {
    ...structuredClone(base),
    status: base.status || 'started',
    phase,
    players,
    turn,
    pending: null,
    game: {} as TState,
    engine: {
      schemaVersion,
      contentVersion,
      rulesVersion,
      kits: {},
      match: createMatchKitState(players, clock.nowMs()),
      round: createRoundKitState(),
      playerValues: createPlayerValuesKitState(),
      configuration: createGameConfigurationState(
        configuration as GameConfigurationShape<object> | undefined,
        players,
        base.metadata?.ownerPlayerId ?? base.metadata?.roomOwnerId,
      ),
      effects: createEffectEngineState(),
      commands: createGameCommandJournalState(),
      submissions: createSubmissionKitState(),
      scheduler: createGameSchedulerState(),
    },
  };
}
