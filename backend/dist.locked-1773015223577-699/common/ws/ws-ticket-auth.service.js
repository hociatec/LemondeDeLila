"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "WsTicketAuthService", {
    enumerable: true,
    get: function() {
        return WsTicketAuthService;
    }
});
const _common = require("@nestjs/common");
const _wsticketservice = require("./ws-ticket.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let WsTicketAuthService = class WsTicketAuthService {
    /**
   * Validates a short-lived WS ticket from query or headers.
   * Returns true if valid; false otherwise (callers typically close the socket).
   */ validate(client, args, scope) {
        const ticket = this.extractTicket(client, args);
        if (!ticket) {
            return false;
        }
        try {
            this.tickets.verify(ticket, scope);
            return true;
        } catch  {
            return false;
        }
    }
    /**
   * Some WS endpoints support unauthenticated use (ex: login).
   * In that case, only enforce a ticket when a user token is present.
   */ validateIfTokenPresent(client, args, scope, hasUserToken) {
        if (!hasUserToken) {
            return true;
        }
        return this.validate(client, args, scope);
    }
    validateIfTokenPresentDetailed(client, args, scope, hasUserToken) {
        if (!hasUserToken) {
            return {
                ok: true,
                reason: 'not_required',
                ticketPresent: false
            };
        }
        const ticket = this.extractTicket(client, args);
        if (!ticket) {
            return {
                ok: false,
                reason: 'missing_ticket',
                ticketPresent: false
            };
        }
        try {
            this.tickets.verify(ticket, scope);
            return {
                ok: true,
                reason: 'ok',
                ticketPresent: true
            };
        } catch  {
            return {
                ok: false,
                reason: 'invalid_ticket',
                ticketPresent: true
            };
        }
    }
    extractTicket(client, args) {
        const firstArg = args[0];
        const request = this.resolveRequest(client, firstArg);
        const urlCandidate = this.pickUrl(client, request);
        if (urlCandidate) {
            const trimmedUrl = urlCandidate.trim();
            if (trimmedUrl) {
                try {
                    const url = new URL(trimmedUrl, 'ws://localhost');
                    const fromQuery = url.searchParams.get('ticket') ?? url.searchParams.get('wsTicket');
                    if (fromQuery && fromQuery.trim()) {
                        return fromQuery.trim();
                    }
                } catch  {
                /* ignore */ }
            }
        }
        const headers = client.handshakeHeaders ?? request?.headers;
        return this.readTicketHeader(headers);
    }
    readTicketHeader(headers) {
        if (!headers) {
            return null;
        }
        const candidates = [
            'x-lila-ws-ticket',
            'x-lila-ticket',
            'x-ws-ticket'
        ];
        for (const key of candidates){
            const value = this.normalizeHeaderValue(headers[key]);
            if (value) {
                return value;
            }
        }
        return null;
    }
    resolveRequest(client, firstArg) {
        if (firstArg && typeof firstArg === 'object' && firstArg !== null) {
            return firstArg;
        }
        return client.upgradeReq ?? client.req ?? null;
    }
    pickUrl(client, request) {
        const raw = (typeof client.url === 'string' ? client.url : '') || (typeof request?.url === 'string' ? request.url : '');
        const trimmed = raw.trim();
        return trimmed || null;
    }
    normalizeHeaderValue(raw) {
        if (!raw) return null;
        const value = Array.isArray(raw) ? raw[0] : raw;
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        return trimmed || null;
    }
    constructor(tickets){
        this.tickets = tickets;
    }
};
WsTicketAuthService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _wsticketservice.WsTicketService === "undefined" ? Object : _wsticketservice.WsTicketService
    ])
], WsTicketAuthService);
