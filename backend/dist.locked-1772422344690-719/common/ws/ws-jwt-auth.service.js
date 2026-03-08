"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "WsJwtAuthService", {
    enumerable: true,
    get: function() {
        return WsJwtAuthService;
    }
});
const _common = require("@nestjs/common");
const _config = require("@nestjs/config");
const _jsonwebtoken = require("jsonwebtoken");
const _jwtconfig = require("../auth/jwt-config");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let WsJwtAuthService = class WsJwtAuthService {
    extractToken(client, args) {
        const firstArg = args[0];
        const request = this.resolveRequest(client, firstArg);
        const urlCandidate = this.pickUrl(client, request);
        const headerToken = this.extractBearer(client.handshakeHeaders) || this.extractBearer(request?.headers);
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
        const headerVersion = this.readHeader(headers, 'x-lila-client-version') ?? this.readHeader(headers, 'X-Lila-Client-Version');
        if (headerVersion) {
            return headerVersion;
        }
        if (urlCandidate) {
            try {
                const url = new URL(urlCandidate, 'ws://localhost');
                const fromQuery = url.searchParams.get('v') ?? url.searchParams.get('version') ?? url.searchParams.get('clientVersion') ?? '';
                const trimmed = fromQuery.trim();
                return trimmed || null;
            } catch  {
                return null;
            }
        }
        return null;
    }
    verify(token) {
        const key = (0, _jwtconfig.requireJwtVerifyKey)(this.config);
        const issuer = this.config.get('JWT_ISSUER', 'le-monde-de-lila');
        const audienceRaw = this.config.get('JWT_AUDIENCE');
        const audience = audienceRaw && typeof audienceRaw === 'string' && audienceRaw.trim() ? audienceRaw.trim() : undefined;
        const clockTolerance = this.config.get('JWT_CLOCK_TOLERANCE_SECONDS', 10);
        try {
            const verifyOptions = {
                algorithms: (0, _jwtconfig.getJwtVerifyAlgorithms)(this.config),
                issuer,
                clockTolerance,
                ...audience ? {
                    audience
                } : {}
            };
            const payload = (0, _jsonwebtoken.verify)(token, key, verifyOptions);
            if (!payload || typeof payload !== 'object') {
                throw new _common.UnauthorizedException('Token invalide');
            }
            const record = WsJwtAuthService.toRecord(payload);
            const sub = WsJwtAuthService.getTrimmedString(record, 'sub');
            const id = WsJwtAuthService.getNumber(record, 'id');
            const exp = WsJwtAuthService.getNumber(record, 'exp');
            const iat = WsJwtAuthService.getNumber(record, 'iat');
            if (!sub || id == null || exp == null || iat == null) {
                throw new _common.UnauthorizedException('Token invalide');
            }
            return WsJwtAuthService.buildVerifiedPayload(record, id, sub, exp, iat);
        } catch  {
            throw new _common.UnauthorizedException('Token invalide');
        }
    }
    tryVerify(token) {
        if (!token) return null;
        try {
            return this.verify(token);
        } catch  {
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
        const raw = (typeof client.url === 'string' ? client.url : '') || (typeof request?.url === 'string' ? request.url : '');
        const trimmed = raw.trim();
        return trimmed || null;
    }
    readHeader(headers, key) {
        if (!headers) return null;
        const normalizedKey = key.toLowerCase();
        const raw = headers[normalizedKey];
        return this.normalizeHeaderValue(raw);
    }
    extractBearer(headers) {
        if (!headers) return null;
        const authHeader = this.readHeader(headers, 'authorization') ?? this.readHeader(headers, 'Authorization');
        if (!authHeader) return null;
        const parts = authHeader.split(' ');
        if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
            return parts[1];
        }
        return null;
    }
    normalizeHeaderValue(raw) {
        if (!raw) return null;
        const value = Array.isArray(raw) ? raw[0] : raw;
        if (typeof value !== 'string') return null;
        return value.trim() || null;
    }
    extractQueryToken(urlCandidate) {
        if (!urlCandidate) {
            return null;
        }
        try {
            const url = new URL(urlCandidate, 'ws://localhost');
            return url.searchParams.get('token');
        } catch  {
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
        return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
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
        const strings = value.filter((item)=>typeof item === 'string');
        return strings.length > 0 ? strings : undefined;
    }
    static buildVerifiedPayload(record, id, sub, exp, iat) {
        return {
            id,
            username: WsJwtAuthService.getTrimmedString(record, 'username') || sub,
            email: WsJwtAuthService.getOptionalString(record, 'email'),
            roles: WsJwtAuthService.getStringArray(record, 'roles'),
            sub,
            exp,
            iat
        };
    }
    constructor(config){
        this.config = config;
    }
};
WsJwtAuthService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _config.ConfigService === "undefined" ? Object : _config.ConfigService
    ])
], WsJwtAuthService);
