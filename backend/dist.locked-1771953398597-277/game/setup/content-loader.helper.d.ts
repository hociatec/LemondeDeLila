import { GameContentLoaderService } from '../engine/services/game-content-loader.service';
type LoadV1Params = {
    gameType: string;
    baseDir: string;
    filename: string;
    contentDir?: string;
    arrayField?: string;
    minItems?: number;
    extraValidators?: Array<(payload: unknown) => void>;
};
export declare function loadV1Content<T>(contentLoader: GameContentLoaderService, params: LoadV1Params): T;
export {};
