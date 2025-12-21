import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../../engine/dto/game-action.dto';

@Injectable()
export class PetitChevauxPresenterService {
  exposeState(state: GameStateEntity): GameStateWithActions {
    return { ...state, actions: [] };
  }
}
