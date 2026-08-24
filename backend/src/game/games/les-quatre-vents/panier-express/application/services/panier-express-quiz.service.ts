import { GameCoreService } from '../../../../../application/services/game-core.service';
import { GameStateEntity } from '../../../../../application/models/game-state.model';
import {
  QuizRunnerService,
  QuizQuestion,
  QuizState,
} from '../../../../../application/features/quiz/services/quiz-runner.service';
import {
  DeckPoolService,
  DeckPoolState,
} from '../../../../../application/services/deck-pool.service';
import { RandomService } from '../../../../../application/services/random.service';
import { sanitizeText } from '../../../../../../common/utils/public-api';
import {
  PanierExpressMetadata,
  PanierExpressDeckPool,
} from '../../model/panier-express-state.model';
import { PanierExpressUtils } from './panier-express-utils.service';

export class PanierExpressQuizService {
  constructor(
    private readonly deckPool: DeckPoolService,
    private readonly quizRunner: QuizRunnerService,
    private readonly core: GameCoreService,
    private readonly utils: PanierExpressUtils,
    private readonly random: RandomService,
  ) {}

  applyQuiz(state: GameStateEntity, playerId: number): GameStateEntity {
    const meta = state.metadata as PanierExpressMetadata;
    if (!meta.decks) {
      return this.core.appendLog(
        state,
        '[Panier Express] Quiz : deck indisponible.',
      );
    }
    const metaRng = this.random.createMetaRng(meta);
    const { card, pool } = this.deckPool.draw<QuizQuestion>(
      meta.decks as DeckPoolState<QuizQuestion>,
      'quizzes',
      metaRng.rng,
    );
    let metadata: PanierExpressMetadata = {
      ...metaRng.getMeta(),
      decks: pool as PanierExpressDeckPool,
    };
    const quiz = card;
    if (!quiz) {
      return this.core.appendLog(
        state,
        '[Panier Express] Quiz : aucune carte disponible.',
      );
    }

    const question = sanitizeText(quiz.question);
    const answer = sanitizeText(String(quiz.answer ?? '')).trim();
    const rawChoices = Array.isArray(quiz.choices) ? quiz.choices : [];
    const unique = new Set<string>();
    const normalizedChoices: string[] = [];
    for (const choice of rawChoices) {
      const text = sanitizeText(String(choice)).trim();
      const key = text.toLowerCase();
      if (!text || unique.has(key)) continue;
      unique.add(key);
      normalizedChoices.push(text);
    }
    if (answer) {
      const key = answer.toLowerCase();
      if (!unique.has(key)) {
        unique.add(key);
        normalizedChoices.push(answer);
      }
    }
    const shuffled = this.random.shuffle(metadata, normalizedChoices);
    metadata = shuffled.meta;
    const choices = shuffled.values;

    const currentQuizState: QuizState = metadata.quiz ?? { pending: {} };
    const nextQuizState = this.quizRunner.setPending(
      currentQuizState,
      playerId,
      {
        id: quiz.id ?? `quiz-${playerId}`,
        question,
        answer,
        choices,
      },
    );

    const nextMeta: PanierExpressMetadata = {
      ...metadata,
      quiz: nextQuizState,
    };

    const next = { ...state, metadata: nextMeta };
    return this.core.appendLog(
      next,
      `Question pour ${this.utils.playerName(state, playerId)}: "${question}"`,
    );
  }
}
