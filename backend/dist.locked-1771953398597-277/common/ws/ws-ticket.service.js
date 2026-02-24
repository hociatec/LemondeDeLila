"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var WsTicketService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsTicketService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jsonwebtoken_1 = require("jsonwebtoken");
const crypto_1 = require("crypto");
let WsTicketService = WsTicketService_1 = class WsTicketService {
    config;
    logger = new common_1.Logger(WsTicketService_1.name);
    ephemeralSecret = null;
    warnedMissingSecret = false;
    constructor(config) {
        this.config = config;
    }
    issue(userId, scope) {
        if (!Number.isFinite(userId) || userId <= 0) {
            throw new common_1.UnauthorizedException('Utilisateur invalide');
        }
        const expiresInSeconds = this.getTtlSeconds();
        const secret = this.getSecret();
        const payload = {
            sub: String(userId),
            scope,
            jti: (0, crypto_1.randomUUID)(),
        };
        const ticket = (0, jsonwebtoken_1.sign)(payload, secret, {
            expiresIn: expiresInSeconds,
            audience: 'lila-ws',
            issuer: 'lila-backend',
        });
        return { ticket, expiresInSeconds, scope };
    }
    verify(ticket, scope) {
        const secret = this.getSecret();
        try {
            const decoded = (0, jsonwebtoken_1.verify)(ticket, secret, {
                audience: 'lila-ws',
                issuer: 'lila-backend',
            });
            if (!decoded || typeof decoded !== 'object') {
                throw new common_1.UnauthorizedException('Ticket invalide');
            }
            const typed = decoded;
            if (typed.scope !== scope) {
                throw new common_1.UnauthorizedException('Ticket invalide (scope)');
            }
            if (typeof typed.sub !== 'string') {
                throw new common_1.UnauthorizedException('Ticket invalide (sub)');
            }
            const userId = parseInt(typed.sub, 10);
            if (!Number.isFinite(userId) || userId <= 0) {
                throw new common_1.UnauthorizedException('Ticket invalide (sub)');
            }
            if (typeof typed.jti !== 'string' || !typed.jti.trim()) {
                throw new common_1.UnauthorizedException('Ticket invalide (jti)');
            }
            return typed;
        }
        catch {
            throw new common_1.UnauthorizedException('Ticket invalide');
        }
    }
    getSecret() {
        const secret = this.config.get('WS_TICKET_SECRET');
        if (!secret) {
            const nodeEnv = String(this.config.get('NODE_ENV') || process.env.NODE_ENV || '')
                .trim()
                .toLowerCase();
            if (nodeEnv === 'production') {
                throw new common_1.UnauthorizedException('Configuration WS manquante');
            }
            if (!this.ephemeralSecret) {
                this.ephemeralSecret = (0, crypto_1.randomBytes)(32).toString('base64url');
            }
            if (!this.warnedMissingSecret) {
                this.warnedMissingSecret = true;
                this.logger.warn('WS_TICKET_SECRET manquant: utilisation dâ€™un secret Ã©phÃ©mÃ¨re (dev uniquement).');
            }
            return this.ephemeralSecret;
        }
        return secret;
    }
    getTtlSeconds() {
        const raw = this.config.get('WS_TICKET_TTL_SECONDS');
        const ttl = typeof raw === 'number' && Number.isFinite(raw) ? raw : 60;
        return Math.max(10, Math.min(300, ttl));
    }
};
exports.WsTicketService = WsTicketService;
exports.WsTicketService = WsTicketService = WsTicketService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], WsTicketService);
//# sourceMappingURL=ws-ticket.service.js.map