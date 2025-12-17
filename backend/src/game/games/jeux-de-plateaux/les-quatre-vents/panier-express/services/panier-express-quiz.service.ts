import { Injectable } from '@nestjs/common';
import { GameCoreService } from '../../../../../core/services/game-core.service';
import { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import { QuizRunnerService, QuizQuestion, QuizState } from '../../../../../modules/quiz/services/quiz-runner.service';
import { DeckPoolService, DeckPoolState } from '../../../../../modules/cards/services/deck-pool.service';
import { sanitizeText } from '../../../../../../common/utils/sanitize-text';
import { PanierExpressMetadata, PanierExpressDeckPool } from '../entities/panier-express-state.entity';
import { PanierExpressUtils } from './panier-express.utils';

@Injectable()
export class PanierExpressQuizService {
  constructor(
    private readonly deckPool: DeckPoolService,
    private readonly quizRunner: QuizRunnerService,
    private readonly core: GameCoreService,
    private readonly utils: PanierExpressUtils,
  ) {}

  applyQuiz(state: GameStateEntity, playerId: number): GameStateEntity {
    const meta = state.metadata as PanierExpressMetadata;
    if (!meta.decks) {
      return this.core.appendLog(state, '[Panier Express] Quiz : deck indisponible.');
    }
    const { card, pool } = this.deckPool.draw<QuizQuestion>(meta.decks as DeckPoolState<QuizQuestion>, 'quizzes');
    const metadata = { ...meta, decks: pool as PanierExpressDeckPool };
    const quiz = card;
    if (!quiz) {
      return this.core.appendLog(state, '[Panier Express] Quiz : aucune carte disponible.');
    }

    const question = sanitizeText(quiz.question);
    const choices = Array.isArray(quiz.choices) ? quiz.choices.map((choice) => sanitizeText(String(choice))) : [];

    const currentQuizState: QuizState = metadata.quiz ?? { pending: {} };
    const nextQuizState = this.quizRunner.setPending(currentQuizState, playerId, {
      id: quiz.id ?? `quiz-${playerId}`,
      question,
      answer: quiz.answer,
      choices,
    });

    const nextMeta: PanierExpressMetadata = {
      ...metadata,
      quiz: nextQuizState,
    };

    const next = { ...state, metadata: nextMeta };
    return this.core.appendLog(next, `Question pour ${this.utils.playerName(state, playerId)}: "${question}"`);
  }
}
