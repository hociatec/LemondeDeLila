"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "WsTicketService", {
    enumerable: true,
    get: function() {
        return WsTicketService;
    }
});
const _common = require("@nestjs/common");
const _config = require("@nestjs/config");
const _jsonwebtoken = require("jsonwebtoken");
const _crypto = require("crypto");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let WsTicketService = class WsTicketService {
    issue(userId, scope) {
        if (!Number.isFinite(userId) || userId <= 0) {
            throw new _common.UnauthorizedException('Utilisateur invalide');
        }
        const expiresInSeconds = this.getTtlSeconds();
        const secret = this.getSecret();
        const payload = {
            sub: String(userId),
            scope,
            jti: (0, _crypto.randomUUID)()
        };
        const ticket = (0, _jsonwebtoken.sign)(payload, secret, {
            expiresIn: expiresInSeconds,
            audience: 'lila-ws',
            issuer: 'lila-backend'
        });
        return {
            ticket,
            expiresInSeconds,
            scope
        };
    }
    verify(ticket, scope) {
        const secret = this.getSecret();
        try {
            const decoded = (0, _jsonwebtoken.verify)(ticket, secret, {
                audience: 'lila-ws',
                issuer: 'lila-backend'
            });
            if (!decoded || typeof decoded !== 'object') {
                throw new _common.UnauthorizedException('Ticket invalide');
            }
            const typed = decoded;
            if (typed.scope !== scope) {
                throw new _common.UnauthorizedException('Ticket invalide (scope)');
            }
            if (typeof typed.sub !== 'string') {
                throw new _common.UnauthorizedException('Ticket invalide (sub)');
            }
            const userId = parseInt(typed.sub, 10);
            if (!Number.isFinite(userId) || userId <= 0) {
                throw new _common.UnauthorizedException('Ticket invalide (sub)');
            }
            if (typeof typed.jti !== 'string' || !typed.jti.trim()) {
                throw new _common.UnauthorizedException('Ticket invalide (jti)');
            }
            return typed;
        } catch  {
            throw new _common.UnauthorizedException('Ticket invalide');
        }
    }
    getSecret() {
        const secret = this.config.get('WS_TICKET_SECRET');
        if (!secret) {
            const nodeEnv = String(this.config.get('NODE_ENV') || process.env.NODE_ENV || '').trim().toLowerCase();
            if (nodeEnv === 'production') {
                throw new _common.UnauthorizedException('Configuration WS manquante');
            }
            if (!this.ephemeralSecret) {
                // Dev-only fallback to keep local setups working even when WS_TICKET_SECRET is missing.
                this.ephemeralSecret = (0, _crypto.randomBytes)(32).toString('base64url');
            }
            if (!this.warnedMissingSecret) {
                this.warnedMissingSecret = true;
                this.logger.warn("WS_TICKET_SECRET manquant: utilisation d'un secret éphémère (dev uniquement).");
            }
            return this.ephemeralSecret;
        }
        return secret;
    }
    getTtlSeconds() {
        const raw = this.config.get('WS_TICKET_TTL_SECONDS');
        const ttl = typeof raw === 'number' && Number.isFinite(raw) ? raw : 60;
        // Keep it short-lived.
        return Math.max(10, Math.min(300, ttl));
    }
    constructor(config){
        this.config = config;
        this.logger = new _common.Logger(WsTicketService.name);
        this.ephemeralSecret = null;
        this.warnedMissingSecret = false;
    }
};
WsTicketService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _config.ConfigService === "undefined" ? Object : _config.ConfigService
    ])
], WsTicketService);
