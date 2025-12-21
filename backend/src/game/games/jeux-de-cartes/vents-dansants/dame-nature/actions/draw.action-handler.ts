import type { ActionHandler } from '../../../../../engine/services/action-dispatcher.service';
import type { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../../engine/dto/game-action.dto';

/**
 * Handler pour l'action 'draw' (piocher une carte).
 *
 * Cette action permet à un joueur de piocher une carte du deck.
 */
export class DrawActionHandler implements ActionHandler {
  readonly actionType = 'draw';

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
