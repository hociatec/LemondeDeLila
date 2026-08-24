import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type { GameSingleActionDto } from '../../../../../application/models/game-action.model';
import type { LamaMetadata } from '../../model/lama.model';
import { LamaRoundService } from './lama-round.service';
import { LamaSharedService } from './lama-shared.service';
import { LamaLogService } from './lama-log.service';
import { LamaInitialStateFactory } from './lama-initial-state.factory';
import { LamaSetupConfigService } from './lama-setup-config.service';

export class LamaSetupService {
  constructor(
    shared: LamaSharedService,
    private readonly round: LamaRoundService,
    logger: LamaLogService,
  ) {
    this.initialStateFactory = new LamaInitialStateFactory(shared);
    this.config = new LamaSetupConfigService(shared, round, logger);
  }

  private readonly initialStateFactory: LamaInitialStateFactory;
  private readonly config: LamaSetupConfigService;

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    return this.initialStateFactory.build(baseState);
  }

  applySetupConfig(
    state: GameStateEntity,
    meta: LamaMetadata,
    action: GameSingleActionDto,
    actorId: number,
  ): GameStateEntity {
    return this.config.apply(state, meta, action, actorId);
  }

  resumeRoundPause(
    state: GameStateEntity,
    meta: LamaMetadata,
  ): GameStateEntity {
    const until =
      typeof meta.roundPauseUntilMs === 'number'
        ? meta.roundPauseUntilMs
        : null;
    if (until != null && Date.now() < until) {
      return state;
    }
    const clearedMeta: LamaMetadata = {
      ...meta,
      roundPauseUntilMs: null,
      step: 'turn_choice',
      suppressTurnAnnouncement: false,
    };
    return this.round.startNewRound(
      {
        ...state,
        turnIndex: (state.turnIndex ?? 0) + 1,
        metadata: clearedMeta,
        phase: 'round',
        round: Number(clearedMeta.roundNumber ?? state.round ?? 1),
      },
      Number(clearedMeta.roundStarterIndex ?? 0),
    );
  }
}
