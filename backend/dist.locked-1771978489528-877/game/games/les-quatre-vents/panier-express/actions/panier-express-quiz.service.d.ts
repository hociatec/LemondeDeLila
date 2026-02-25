import { GameCoreService } from '../../../../core/services/game-core.service';
import { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { QuizRunnerService } from '../../../../modules/quiz/services/quiz-runner.service';
import { DeckPoolService } from '../../../../modules/cards/services/deck-pool.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { PanierExpressUtils } from '../model/panier-express-utils.service';
export declare class PanierExpressQuizService {
    private readonly deckPool;
    private readonly quizRunner;
    private readonly core;
    private readonly utils;
    private readonly random;
    constructor(deckPool: DeckPoolService, quizRunner: QuizRunnerService, core: GameCoreService, utils: PanierExpressUtils, random: RandomService);
    applyQuiz(state: GameStateEntity, playerId: number): GameStateEntity;
}
