import type { ActionHandler } from '../../../../engine/services/action-dispatcher.service';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';

/**
 * Handler pour les actions 'answer_ask_card', 'answer_ask_card_accept' et 'answer_ask_card_refuse'.
 *
 * Ces actions permettent à un joueur de répondre à une demande de carte.
 */
export class AnswerAskCardActionHandler implements ActionHandler {
  constructor(
    readonly actionType: string,
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
