import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../core/services/game-core.service';
export declare class TurnPoliciesService {
    private readonly core;
    constructor(core: GameCoreService);
    private sanitizePlayerName;
    playerName(state: GameStateEntity, playerId: number): string;
    appendTurnAnnouncement(state: GameStateEntity, playerId: number | null | undefined, playerNameResolver?: (state: GameStateEntity, playerId: number) => string): GameStateEntity;
}
