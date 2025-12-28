import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';

@Injectable()
export class PetitChevauxPhaseService {
  advance(state: GameStateEntity): GameStateEntity {
    return state;
  }
}
