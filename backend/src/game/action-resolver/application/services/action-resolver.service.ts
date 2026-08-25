import { Injectable } from '@nestjs/common';
import { GameStateEntity } from '../../../core/application/models/game-state.model';
import { GameSingleActionDto } from '../../../core/application/models/game-action.model';

type ActionDispatcher = (
  state: GameStateEntity,
  action: GameSingleActionDto,
) => GameStateEntity;

@Injectable()
export class ActionResolverService {
  /**
   * Applique en sequence une liste d'actions via un dispatcher fourni.
   */
  apply(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
    dispatch: ActionDispatcher,
  ): GameStateEntity {
    let next = state;
    if (!Array.isArray(actions)) return next;
    for (const action of actions) {
      if (!action?.type) continue;
      next = dispatch(next, action);
    }
    return next;
  }
}
