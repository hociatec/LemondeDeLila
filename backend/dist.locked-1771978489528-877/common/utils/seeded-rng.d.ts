export type SeededRngState = {
    seed: number;
    counter: number;
};
type RngMeta = Record<string, unknown>;
export declare function ensureSeededRng(meta: RngMeta): SeededRngState;
export declare function nextRngFloat(meta: RngMeta): {
    value: number;
    meta: RngMeta;
};
export declare function nextRngInt(meta: RngMeta, maxExclusive: number): {
    value: number;
    meta: RngMeta;
};
export {};
