export declare class AbsurdissimesDeckService {
    private readonly logger;
    private readonly whiteCards;
    private readonly blackCards;
    constructor();
    getWhiteCards(): string[];
    getBlackCards(): string[];
    private loadCards;
    private resolveDataPath;
    private parseCards;
}
