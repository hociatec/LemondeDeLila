import { RandomService } from '../../../../modules/random/services/random.service';
import type { NawakChallenge } from '../model/nawak-challenge.model';
import type { NawakMetadata } from '../model/nawak-state.entity';
export declare class NawakChallengeService {
    private readonly random;
    private readonly logger;
    private readonly challenges;
    constructor(random: RandomService);
    loadChallenge(meta: NawakMetadata): {
        challenge: NawakChallenge;
        meta: NawakMetadata;
    };
    private loadChallenges;
    private parseContent;
}
