import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { LamaMetadata } from '../model/lama.model';
import { RandomService } from '../../../../modules/random/services/random.service';
import { LamaLogService } from '../logging/lama-log.service';
import { LamaSharedService } from '../shared/lama-shared.service';
export declare class LamaRoundService {
    private readonly random;
    private readonly logger;
    private readonly shared;
    constructor(random: RandomService, logger: LamaLogService, shared: LamaSharedService);
    startNewRound(state: GameStateEntity, starterIndex: number): GameStateEntity;
    endRound(state: GameStateEntity, winnerPlayerId: number | null): GameStateEntity;
    finishRoundAndMaybeStartNext(state: GameStateEntity): GameStateEntity;
    isRoundEnded(meta: LamaMetadata, _players: any[]): boolean;
    findNextActivePlayerId(players: any[], meta: LamaMetadata, afterPlayerId: number): number | null;
    findRoundWinnerId(meta: LamaMetadata, players: any[]): number | null;
    private buildDeck;
    private findEmptyHandWinnerId;
    private shouldPromptReturn;
    private buildEliminatedByScore;
    private findNextSurvivorStarterIndex;
}
