import { ConfigService } from '@nestjs/config';
import type { IncomingHttpHeaders, IncomingMessage } from 'http';
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
export declare class WsSignatureService {
    private readonly secret;
    private readonly logger;
    constructor(config: ConfigService);
    isEnabled(): boolean;
    validate(client: WsClientLike, args: unknown[]): boolean;
    private extractSignature;
    private extractHeaderSignature;
    private resolveRequest;
    private pickUrl;
    private normalizeHeaderValue;
    private compare;
    private normalize;
}
