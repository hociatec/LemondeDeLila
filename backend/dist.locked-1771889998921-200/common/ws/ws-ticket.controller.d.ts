import type { Request } from 'express';
import { WsTicketScope, WsTicketService } from './ws-ticket.service';
export declare class WsTicketController {
    private readonly tickets;
    constructor(tickets: WsTicketService);
    getTicket(req: RequestWithUser, scopeRaw: string): {
        ticket: string;
        expiresInSeconds: number;
        scope: WsTicketScope;
    } | {
        error: string;
        allowedScopes: WsTicketScope[];
    };
    getTicketUnderApi(req: RequestWithUser, scopeRaw: string): {
        ticket: string;
        expiresInSeconds: number;
        scope: WsTicketScope;
    } | {
        error: string;
        allowedScopes: WsTicketScope[];
    };
    private issue;
}
type RequestWithUser = Request & {
    user?: {
        id?: number;
    };
};
export {};
