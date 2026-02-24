import { ConfigService } from '@nestjs/config';
import type { IncomingHttpHeaders, IncomingMessage } from 'http';
import type { WsAuthPayload } from '../interfaces/ws-auth-payload';
export type WsRequestLike = IncomingMessage & {
    url?: string;
    headers?: IncomingHttpHeaders;
};
export type WsClientLike = {
    upgradeReq?: WsRequestLike;
    req?: WsRequestLike;
    handshakeHeaders?: IncomingHttpHeaders;
    url?: string;
};
export declare class WsJwtAuthService {
    private readonly config;
    constructor(config: ConfigService);
    extractToken(client: WsClientLike, args: unknown[]): string | null;
    extractClientVersion(client: WsClientLike, args: unknown[]): string | null;
    verify(token: string): WsAuthPayload;
    tryVerify(token: string | null): WsAuthPayload | null;
    private resolveRequest;
    private pickUrl;
    private readHeader;
    private extractBearer;
    private normalizeHeaderValue;
    private extractQueryToken;
    private static toRecord;
    private static getTrimmedString;
    private static getOptionalString;
    private static getNumber;
    private static getStringArray;
    private static buildVerifiedPayload;
}
