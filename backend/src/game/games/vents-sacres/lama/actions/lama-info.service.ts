import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { LamaMetadata, LamaCardValue } from '../model/lama.model';
import { lamaCardLabel } from '../model/lama.model';
import { LamaSharedService } from '../shared/lama-shared.service';

@Injectable()
export class LamaInfoService {
  constructor(private readonly shared: LamaSharedService) {}

  applyInfoAction(
    state: GameStateEntity,
    meta: LamaMetadata,
    actionType: string,
    actorId: number,
  ): GameStateEntity {
    if (actionType === 'lama_preview') return state;
    const discard = Array.isArray(meta.discard) ? meta.discard : [];
    const top = discard.length ? (discard[discard.length - 1] as LamaCardValue) : null;
    const players = Array.isArray(state.players) ? state.players : [];
    const name = this.shared.playerLabel(players, actorId);
    const log = Array.isArray(state.log) ? [...state.log] : [];
    log.push({ message: `${name} regarde la défausse : ${top ? lamaCardLabel(top) : '(vide)'}.` });
    return { ...state, log };
  }
}
