import { WsTicketScope, WsTicketService } from './ws-ticket.service';
import type { IncomingHttpHeaders, IncomingMessage } from 'http';
type WsRequestLike = IncomingMessage & {
    url?: string;
    headers?: IncomingHttpHeaders;
};
type WsClientLike = {
    upgradeReq?: WsRequestLike;
    req?: WsRequestLike;
    handshakeHeaders?: IncomingHttpHeaders;
    url?: string;
};
export type WsTicketValidationResult = {
    ok: true;
    reason: 'not_required' | 'ok';
    ticketPresent: boolean;
} | {
    ok: false;
    reason: 'missing_ticket' | 'invalid_ticket';
    ticketPresent: boolean;
};
export declare class WsTicketAuthService {
    private readonly tickets;
    constructor(tickets: WsTicketService);
    validate(client: WsClientLike, args: unknown[], scope: WsTicketScope): boolean;
    validateIfTokenPresent(client: WsClientLike, args: unknown[], scope: WsTicketScope, hasUserToken: boolean): boolean;
    validateIfTokenPresentDetailed(client: WsClientLike, args: unknown[], scope: WsTicketScope, hasUserToken: boolean): WsTicketValidationResult;
    private extractTicket;
    private readTicketHeader;
    private resolveRequest;
    private pickUrl;
    private normalizeHeaderValue;
}
export {};
