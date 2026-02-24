import { DeckManagerService } from '../../../../modules/cards/services/deck-manager.service';
import { DeckPoolService } from '../../../../modules/cards/services/deck-pool.service';
import { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { PanierExpressMetadata, PanierExpressTile } from '../model/panier-express-state.entity';
import { PanierExpressPawn } from '../model/panier-express-content.entity';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
export declare class PanierExpressSetupService {
    private readonly decks;
    private readonly deckPool;
    private readonly contentLoader;
    private static readonly MAX_STAND_ITEMS;
    constructor(decks: DeckManagerService, deckPool: DeckPoolService, contentLoader: GameContentLoaderService);
    private loadBoard;
    private loadCourses;
    private loadStands;
    private loadEvents;
    private loadExchanges;
    private loadQuizzes;
    private loadPawns;
    courseItems(): string[];
    eventCards(): string[];
    exchangeCards(): string[];
    standCourseMap(): Record<string, string[]>;
    buildTiles(): PanierExpressTile[];
    private extractSeed;
    buildDeckPool(baseState?: GameStateEntity): PanierExpressMetadata['decks'];
    buildQuizDeck(seed?: number | null): Array<{
        id?: string;
        question: string;
        answer: string;
        choices: string[];
    }>;
    pawns(): string[];
    pawnChoices(): PanierExpressPawn[];
    buildReplenishableDeck(items?: string[]): string[];
    private setDeck;
}
