export type DeckPoolState<T = any> = Record<string, {
    deck: T[];
    discards: T[];
}>;
export declare class DeckPoolService {
    shuffle<T>(arr: T[], rng?: () => number): T[];
    draw<T>(pool: DeckPoolState<T>, key: string, rng?: () => number): {
        card: T | null;
        pool: DeckPoolState<T>;
    };
    drawMany<T>(pool: DeckPoolState<T>, key: string, count: number, rng?: () => number): {
        cards: T[];
        pool: DeckPoolState<T>;
    };
    discardMany<T>(pool: DeckPoolState<T>, key: string, cards: readonly T[]): DeckPoolState<T>;
    discard<T>(pool: DeckPoolState<T>, key: string, card: T): DeckPoolState<T>;
    set<T>(pool: DeckPoolState<T>, key: string, deck: T[], discards?: T[]): DeckPoolState<T>;
}
