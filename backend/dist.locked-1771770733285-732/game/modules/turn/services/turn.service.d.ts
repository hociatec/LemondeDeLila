import type { ModuleOverviewDto } from '../../dto/generic-module.dto';
export declare class TurnService {
    getOverview(): ModuleOverviewDto;
    nextTurn(players: Array<{
        id: number;
    }>, currentIndex: number, skipTurn: Record<number, number>): {
        turnIndex: number;
        currentPlayerId: number;
        skipTurn: Record<number, number>;
        skipped?: Array<{
            id: number;
            remainingBefore: number;
            remainingAfter: number;
        }>;
    };
}
