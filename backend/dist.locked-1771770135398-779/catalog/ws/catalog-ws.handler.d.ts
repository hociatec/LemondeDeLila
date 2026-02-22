import { CatalogService } from '../services/catalog.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
export declare class CatalogWsHandler {
    private readonly catalog;
    private readonly validator;
    constructor(catalog: CatalogService, validator: PayloadValidationService);
    all(): Promise<{
        type: string;
        payload: {
            categories: import("../services/catalog.service").CategoryNode[];
            games: import("../services/catalog.service").CatalogGame[];
        };
    }>;
    categories(): Promise<{
        type: string;
        payload: import("../services/catalog.service").FlatCategory[];
    }>;
    categoryGames(payload: any): Promise<{
        type: string;
        payload: import("../services/catalog.service").CatalogGame[];
    }>;
    games(): Promise<{
        type: string;
        payload: import("../services/catalog.service").CatalogGame[];
    }>;
}
