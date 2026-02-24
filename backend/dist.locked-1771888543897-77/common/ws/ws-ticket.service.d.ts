import { ConfigService } from '@nestjs/config';
export type WsTicketScope = 'api' | 'presence' | 'notify' | 'room' | 'game';
export type WsTicketPayload = {
    sub: string;
    scope: WsTicketScope;
    jti: string;
};
export declare class WsTicketService {
    private readonly config;
    private readonly logger;
    private ephemeralSecret;
    private warnedMissingSecret;
    constructor(config: ConfigService);
    issue(userId: number, scope: WsTicketScope): {
        ticket: string;
        expiresInSeconds: number;
        scope: WsTicketScope;
    };
    verify(ticket: string, scope: WsTicketScope): WsTicketPayload;
    private getSecret;
    private getTtlSeconds;
}
