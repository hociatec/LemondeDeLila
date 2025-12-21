import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../../core/entities/game-state.entity';

@Injectable()
export class PetitChevauxSetupService {
  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    return baseState;
  }
}
