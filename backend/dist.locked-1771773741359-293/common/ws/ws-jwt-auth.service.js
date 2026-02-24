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
var WsJwtAuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsJwtAuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jsonwebtoken_1 = require("jsonwebtoken");
const jwt_config_1 = require("../auth/jwt-config");
let WsJwtAuthService = WsJwtAuthService_1 = class WsJwtAuthService {
    config;
    constructor(config) {
        this.config = config;
    }
    extractToken(client, args) {
        const firstArg = args[0];
        const request = this.resolveRequest(client, firstArg);
        const urlCandidate = this.pickUrl(client, request);
        const headerToken = this.extractBearer(client.handshakeHeaders) ||
            this.extractBearer(request?.headers);
        if (headerToken) {
            return headerToken;
        }
        return this.extractQueryToken(urlCandidate);
    }
    extractClientVersion(client, args) {
        const firstArg = args[0];
        const request = this.resolveRequest(client, firstArg);
        const urlCandidate = this.pickUrl(client, request);
        const headers = client.handshakeHeaders ?? request?.headers;
        const headerVersion = this.readHeader(headers, 'x-lila-client-version') ??
            this.readHeader(headers, 'X-Lila-Client-Version');
        if (headerVersion) {
            return headerVersion;
        }
        if (urlCandidate) {
            try {
                const url = new URL(urlCandidate, 'ws://localhost');
                const fromQuery = url.searchParams.get('v') ??
                    url.searchParams.get('version') ??
                    url.searchParams.get('clientVersion') ??
                    '';
                const trimmed = fromQuery.trim();
                return trimmed || null;
            }
            catch {
                return null;
            }
        }
        return null;
    }
    verify(token) {
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
                ...(audience ? { audience } : {}),
            };
            const payload = (0, jsonwebtoken_1.verify)(token, key, verifyOptions);
            if (!payload || typeof payload !== 'object') {
                throw new common_1.UnauthorizedException('Token invalide');
            }
            const record = WsJwtAuthService_1.toRecord(payload);
            const sub = WsJwtAuthService_1.getTrimmedString(record, 'sub');
            const id = WsJwtAuthService_1.getNumber(record, 'id');
            const exp = WsJwtAuthService_1.getNumber(record, 'exp');
            const iat = WsJwtAuthService_1.getNumber(record, 'iat');
            if (!sub || id == null || exp == null || iat == null) {
                throw new common_1.UnauthorizedException('Token invalide');
            }
            return WsJwtAuthService_1.buildVerifiedPayload(record, id, sub, exp, iat);
        }
        catch {
            throw new common_1.UnauthorizedException('Token invalide');
        }
    }
    tryVerify(token) {
        if (!token)
            return null;
        try {
            return this.verify(token);
        }
        catch {
            return null;
        }
    }
    resolveRequest(client, firstArg) {
        if (firstArg && typeof firstArg === 'object' && firstArg !== null) {
            return firstArg;
        }
        return client.upgradeReq ?? client.req ?? null;
    }
    pickUrl(client, request) {
        const raw = (typeof client.url === 'string' ? client.url : '') ||
            (typeof request?.url === 'string' ? request.url : '');
        const trimmed = raw.trim();
        return trimmed || null;
    }
    readHeader(headers, key) {
        if (!headers)
            return null;
        const normalizedKey = key.toLowerCase();
        const raw = headers[normalizedKey];
        return this.normalizeHeaderValue(raw);
    }
    extractBearer(headers) {
        if (!headers)
            return null;
        const authHeader = this.readHeader(headers, 'authorization') ??
            this.readHeader(headers, 'Authorization');
        if (!authHeader)
            return null;
        const parts = authHeader.split(' ');
        if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
            return parts[1];
        }
        return null;
    }
    normalizeHeaderValue(raw) {
        if (!raw)
            return null;
        const value = Array.isArray(raw) ? raw[0] : raw;
        if (typeof value !== 'string')
            return null;
        return value.trim() || null;
    }
    extractQueryToken(urlCandidate) {
        if (!urlCandidate) {
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
    static toRecord(value) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            return value;
        }
        return {};
    }
    static getTrimmedString(record, key) {
        const value = record[key];
        return typeof value === 'string' ? value.trim() : '';
    }
    static getOptionalString(record, key) {
        const value = record[key];
        return typeof value === 'string' && value.trim().length > 0
            ? value.trim()
            : undefined;
    }
    static getNumber(record, key) {
        const value = record[key];
        return typeof value === 'number' && Number.isFinite(value) ? value : null;
    }
    static getStringArray(record, key) {
        const value = record[key];
        if (!Array.isArray(value)) {
            return undefined;
        }
        const strings = value.filter((item) => typeof item === 'string');
        return strings.length > 0 ? strings : undefined;
    }
    static buildVerifiedPayload(record, id, sub, exp, iat) {
        return {
            id,
            username: WsJwtAuthService_1.getTrimmedString(record, 'username') || sub,
            email: WsJwtAuthService_1.getOptionalString(record, 'email'),
            roles: WsJwtAuthService_1.getStringArray(record, 'roles'),
            sub,
            exp,
            iat,
        };
    }
};
exports.WsJwtAuthService = WsJwtAuthService;
exports.WsJwtAuthService = WsJwtAuthService = WsJwtAuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], WsJwtAuthService);
//# sourceMappingURL=ws-jwt-auth.service.js.map