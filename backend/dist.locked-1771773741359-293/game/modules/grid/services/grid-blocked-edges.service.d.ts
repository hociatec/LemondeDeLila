export declare class GridBlockedEdgesService {
    buildFromWalls(size: number, walls: {
        h?: string[];
        v?: string[];
    } | null | undefined): Record<string, {
        n: boolean;
        e: boolean;
        s: boolean;
        w: boolean;
    }>;
}
