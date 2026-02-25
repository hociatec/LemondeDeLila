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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsJwtGuard = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const jwt_config_1 = require("../auth/jwt-config");
let WsJwtGuard = class WsJwtGuard {
    config;
    constructor(config) {
        this.config = config;
    }
    canActivate(context) {
        const client = context.switchToWs().getClient();
        const request = client.req || client.request;
        const handshake = client.handshake;
        const token = this.extractBearer(client.handshakeHeaders) ||
            this.extractBearer(handshake?.headers) ||
            this.extractBearer(request?.headers) ||
            this.extractBearer(handshake?.auth) ||
            this.extractQueryToken(client.url || request?.url) ||
            this.extractQueryToken(handshake?.url) ||
            this.extractQueryTokenFromAuth(handshake?.auth);
        const payload = this.verify(token);
        client.user = payload;
        return true;
    }
    extractBearer(headers) {
        if (!headers) {
            return null;
        }
        const authHeader = headers['authorization'] || headers['Authorization'];
        if (authHeader && typeof authHeader === 'string') {
            const parts = authHeader.split(' ');
            if (parts.length === 2 &&
                parts[0].toLowerCase() === 'bearer' &&
                parts[1]) {
                return parts[1];
            }
        }
        return null;
    }
    extractQueryTokenFromAuth(auth) {
        if (!auth) {
            return null;
        }
        const token = auth['token'];
        if (typeof token === 'string' && token.trim() !== '') {
            return token;
        }
        return null;
    }
    extractQueryToken(urlCandidate) {
        if (!urlCandidate || typeof urlCandidate !== 'string') {
            return null;
        }
        try {
            const url = new URL(urlCandidate, 'ws://localhost');
            return url.searchParams.get('token');
        }
        catch {
            return null;
        }
    }
    verify(token) {
        if (!token) {
            throw new common_1.UnauthorizedException('Token manquant');
        }
        const key = (0, jwt_config_1.requireJwtVerifyKey)(this.config);
        const issuer = this.config.get('JWT_ISSUER', 'le-monde-de-lila');
        const audienceRaw = this.config.get('JWT_AUDIENCE');
        const audience = audienceRaw && typeof audienceRaw === 'string' && audienceRaw.trim()
            ? audienceRaw.trim()
            : undefined;
        const clockTolerance = this.config.get('JWT_CLOCK_TOLERANCE_SECONDS', 10);
        try {
            const verifyOptions = {
                algorithms: (0, jwt_config_1.getJwtVerifyAlgorithms)(this.config),
                issuer,
                clockTolerance,
            };
            if (audience) {
                verifyOptions.audience = audience;
            }
            const payload = jwtVerify(token, key, verifyOptions);
            if (!payload || typeof payload !== 'object') {
                throw new common_1.UnauthorizedException('Token invalide');
            }
            const typedPayload = payload;
            if (typeof typedPayload.sub !== 'string' ||
                !typedPayload.sub.trim() ||
                typeof typedPayload.id !== 'number' ||
                typeof typedPayload.exp !== 'number' ||
                typeof typedPayload.iat !== 'number') {
                throw new common_1.UnauthorizedException('Token invalide');
            }
            if (!Number.isFinite(typedPayload.id) || typedPayload.id <= 0) {
                throw new common_1.UnauthorizedException('Token invalide');
            }
            return typedPayload;
        }
        catch {
            throw new common_1.UnauthorizedException('Token invalide');
        }
    }
};
exports.WsJwtGuard = WsJwtGuard;
exports.WsJwtGuard = WsJwtGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], WsJwtGuard);
const jwtVerify = jsonwebtoken_1.default.verify;
//# sourceMappingURL=ws-jwt.guard.js.map