export type CanonicalPawn = {
    id: string;
    name: string;
    description: string;
};
export declare function loadCanonicalPawns(rawPawns: unknown): CanonicalPawn[];
