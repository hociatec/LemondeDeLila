import type { ActionHandler } from '../../../../../engine/services/action-dispatcher.service';
import type { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../../engine/dto/game-action.dto';

/**
 * Handler pour l'action 'ask_card' (demander une carte à un adversaire).
 *
 * Cette action permet à un joueur de demander une carte spécifique à un autre joueur.
 */
export class AskCardActionHandler implements ActionHandler {
  readonly actionType = 'ask_card';

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
