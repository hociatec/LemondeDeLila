import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { RandomService } from '../../../../modules/random/services/random.service';
import { AbsurdissimesDeckService } from '../data/absurdissimes-deck.service';
export declare class AbsurdissimesSetupService {
    private readonly deck;
    private readonly random;
    constructor(deck: AbsurdissimesDeckService, random: RandomService);
    hydrateInitialState(baseState: GameStateEntity): GameStateEntity;
}
