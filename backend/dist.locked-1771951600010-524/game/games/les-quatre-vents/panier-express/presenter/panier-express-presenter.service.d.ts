import type { GameStateEntity, PendingState } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto, GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import type { QuizQuestion } from '../../../../modules/quiz/services/quiz-runner.service';
import type { PanierExpressMetadata } from '../model/panier-express-state.entity';
import { PanierExpressUtils } from '../model/panier-express-utils.service';
import { BasePresenterService } from '../../../../engine/abstract/base-presenter.service';
import { BoardPayloadService } from '../../../../modules/board/services/board-payload.service';
export declare class PanierExpressPresenterService extends BasePresenterService {
    private readonly utils;
    private readonly boardPayload;
    private pendingQuizRef;
    private rawPendingRef;
    constructor(utils: PanierExpressUtils, boardPayload: BoardPayloadService);
    exposeState(params: {
        state: GameStateEntity;
        actions: GameSingleActionDto[];
        rawPending: PendingState | null;
        pendingQuiz: QuizQuestion | undefined;
        currentId: number | null;
    }): GameStateWithActions;
    protected buildCatalog(): {
        phases: string[];
        victory: unknown;
    };
    protected buildPendingState(_state: GameStateEntity, _metadata: PanierExpressMetadata, currentPlayerId: number | null): PendingState | null;
    protected buildExtras(state: GameStateEntity, metadata: PanierExpressMetadata, currentPlayerId: number | null): Record<string, unknown>;
    private buildBoardTurns;
    private buildPendingView;
    private normalizeQuizPending;
    private buildPlayerViews;
    private buildPlayerView;
    private buildExtrasView;
    private buildQuizFeedbackMessage;
    private buildPositionPanelMessage;
    private toStringArray;
    private getPanierMeta;
}
