import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { NawakChallengeService } from '../data/nawak-challenge.service';
export declare class NawakSetupService {
    private readonly challengeService;
    constructor(challengeService: NawakChallengeService);
    hydrateInitialState(baseState: GameStateEntity): GameStateEntity;
}
