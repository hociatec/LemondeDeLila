import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../../engine/dto/game-action.dto';

@Injectable()
export class PetitChevauxActionService {
  applyActions(
    state: GameStateEntity,
    _actions: GameSingleActionDto[],
  ): GameStateEntity {
    return state;
  }
}
