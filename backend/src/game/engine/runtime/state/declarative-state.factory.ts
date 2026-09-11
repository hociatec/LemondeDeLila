import type { GameClock } from '../../../core/application/models/game-execution-context.model';
import type { GameState } from '../../../core/application/models/game-state.model';
import type { DeclarativeState } from './declarative-state';
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
import { GAME_ENGINE_ALGORITHM_VERSION } from '../content/engine-algorithm-version';

export function createDeclarativeState<TState extends object>(
  base: GameState,
  phase: string,
  turn: NonNullable<GameState['turn']>,
  clock: GameClock,
  schemaVersion: number,
  contentVersion: string,
  rulesVersion: string,
  configuration: GameConfigurationShape<TState> | undefined,
  contentDigest?: string,
): DeclarativeState<TState> {
  const players = structuredClone(base.players ?? []);
  return {
    ...structuredClone(base),
    status: base.status || 'started',
    phase,
    players,
    turn: structuredClone(turn),
    pending: null,
    game: {} as TState,
    engine: {
      algorithmVersion: GAME_ENGINE_ALGORITHM_VERSION,
      schemaVersion,
      contentVersion,
      ...(contentDigest === undefined ? {} : { contentDigest }),
      rulesVersion,
      kits: {},
      match: createMatchKitState(players, clock.nowMs()),
      round: createRoundKitState(),
      playerValues: createPlayerValuesKitState(),
      configuration: createGameConfigurationState(
        configuration,
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
