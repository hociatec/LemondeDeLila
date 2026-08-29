import type { GameClock } from '../../models/game-execution-context.model';
import type { GameStateEntity } from '../../models/game-state.model';
import type { DeclarativeState } from '../definitions/game-definition';
import { createMatchKitState } from '../kits/match-kit';
import { createPlayerValuesKitState } from '../kits/player-values-kit';
import { createRoundKitState } from '../kits/round-kit';
import {
  createGameConfigurationState,
  type GameConfigurationShape,
} from '../configuration/configuration-kit';
import { createEffectEngineState } from '../effects/effects-kit';
import { createGameCommandJournalState } from '../actions/game-command-journal';
import { createSubmissionKitState } from '../submissions/submission-kit';
import { createGameSchedulerState } from '../automation/scheduler-kit';

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
