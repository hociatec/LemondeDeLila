export type PiratesCardEffect = {
    kind: 'move';
    delta: number;
} | {
    kind: 'skip';
    turns: number;
} | {
    kind: 'immunity';
    turns: number;
} | {
    kind: 'gainGold';
    amount: number;
} | {
    kind: 'loseGold';
    amount: number;
} | {
    kind: 'reroll';
} | {
    kind: 'targetMove';
    delta: number;
} | {
    kind: 'stealTreasure';
    count: number;
};
export declare const OBSTACLE_CARD_EFFECTS: Record<number, PiratesCardEffect>;
export declare const BONUS_CARD_EFFECTS: Record<number, PiratesCardEffect>;
export declare function describeEffect(effect: PiratesCardEffect): string;
