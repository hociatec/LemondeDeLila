export declare class RandomService {
    createMetaRng<TMeta extends Record<string, any>>(meta: TMeta): {
        rng: () => number;
        getMeta: () => TMeta;
    };
    nextFloat<TMeta extends Record<string, any>>(meta: TMeta): {
        value: number;
        meta: TMeta;
    };
    nextInt<TMeta extends Record<string, any>>(meta: TMeta, maxExclusive: number): {
        value: number;
        meta: TMeta;
    };
    rollDice<TMeta extends Record<string, any>>(meta: TMeta, sides: number): {
        roll: number;
        meta: TMeta;
    };
    pickIndex<TMeta extends Record<string, any>>(meta: TMeta, length: number): {
        index: number;
        meta: TMeta;
    };
    pickOne<T, TMeta extends Record<string, any>>(meta: TMeta, values: readonly T[]): {
        value: T | null;
        meta: TMeta;
    };
    shuffle<T, TMeta extends Record<string, any>>(meta: TMeta, values: readonly T[]): {
        values: T[];
        meta: TMeta;
    };
}
