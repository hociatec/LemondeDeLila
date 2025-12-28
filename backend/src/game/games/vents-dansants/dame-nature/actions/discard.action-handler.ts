import type { ActionHandler } from '../../../../engine/services/action-dispatcher.service';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';

/**
 * Handler pour l'action 'discard_card' (défausser une carte).
 *
 * Cette action permet à un joueur de défausser une carte de sa main.
 */
export class DiscardCardActionHandler implements ActionHandler {
  readonly actionType = 'discard_card';

  constructor(
    private readonly handleFn: (
      state: GameStateEntity,
      action: GameSingleActionDto,
      actorId: number | null,
    ) => GameStateEntity,
  ) {}

  handle(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameStateEntity {
    return this.handleFn(state, action, actorId);
  }
}
