import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import type { LamaMetadata } from '../../model/lama.model';
import { lamaCardLabel } from '../../model/lama.model';
import { LamaSharedService } from './lama-shared.service';
import { LamaLogService } from './lama-log.service';

export class LamaInfoService {
  constructor(
    private readonly shared: LamaSharedService,
    private readonly logger: LamaLogService,
  ) {}

  applyInfoAction(
    state: GameStateEntity,
    meta: LamaMetadata,
    actionType: string,
    actorId: number,
  ): GameStateEntity {
    if (actionType === 'lama_preview') return state;
    const discard = Array.isArray(meta.discard) ? meta.discard : [];
    const top = discard.length ? discard[discard.length - 1] : null;
    const players = Array.isArray(state.players) ? state.players : [];
    const name = this.shared.playerLabel(players, actorId);
    const log = this.logger.append(
      state.log,
      `${name} regarde la défausse : ${top ? lamaCardLabel(top) : '(vide)'}.`,
    );
    return { ...state, log };
  }
}



