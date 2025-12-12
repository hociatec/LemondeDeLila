import { Injectable } from '@nestjs/common';
import { GameStateEntity } from '../../../core/entities/game-state.entity';
import { GameSingleActionDto } from '../../../engine/dto/game-action.dto';

type ActionDispatcher = (state: GameStateEntity, action: GameSingleActionDto) => GameStateEntity;

@Injectable()
export class ActionResolverService {
  /**
   * Applique en séquence une liste d'actions via un dispatcher fourni.
   */
  apply(state: GameStateEntity, actions: GameSingleActionDto[], dispatch: ActionDispatcher): GameStateEntity {
    let next = state;
    if (!Array.isArray(actions)) return next;
    for (const action of actions) {
      if (!action?.type) continue;
      next = dispatch(next, action);
    }
    return next;
  }
}
