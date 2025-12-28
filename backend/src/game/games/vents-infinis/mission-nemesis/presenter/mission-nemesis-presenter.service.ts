import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import type { MissionNemesisMetadata } from '../model/mission-nemesis.model';

@Injectable()
export class MissionNemesisPresenterService {
  exposeState(state: GameStateEntity): GameStateWithActions {
    const meta = (state.metadata ?? {}) as MissionNemesisMetadata;
    return {
      ...(state as any),
      actions: [],
      pending: null,
      extras: { message: meta.message ?? null },
    };
  }
}
