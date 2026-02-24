import { ClientUpdatesService } from '../services/client-updates.service';
import type { Request } from 'express';
export declare class ClientUpdatesController {
    private readonly updates;
    constructor(updates: ClientUpdatesService);
    private getOrigin;
    getVersion(current?: string, req?: Request): Promise<{
        version: string | null;
        publishedAt: string | null;
        message: string | null;
        url: string | null;
        minRequiredVersion: string | null;
        current: string | null;
        updateAvailable: boolean | null;
        updateRequired: boolean | null;
    }>;
}
