import type { ActionHandler } from '../../../../../engine/services/action-dispatcher.service';
import type { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../../engine/dto/game-action.dto';

/**
 * Handler pour l'action 'answer_quiz' (répondre à un quiz).
 *
 * Cette action permet à un joueur de répondre à une question quiz.
 */
export class AnswerQuizActionHandler implements ActionHandler {
  readonly actionType = 'answer_quiz';

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
