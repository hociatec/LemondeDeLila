export declare class DeckManagerService {
    shuffle<T>(arr: T[]): T[];
    draw<T>(deck: T[], discards: T[]): {
        card: T;
        deck: T[];
        discards: T[];
    } | null;
}
