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
var WsSignatureService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsSignatureService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto_1 = require("crypto");
let WsSignatureService = WsSignatureService_1 = class WsSignatureService {
    secret;
    logger = new common_1.Logger(WsSignatureService_1.name);
    constructor(config) {
        this.secret = this.normalize(config.get('WS_SHARED_SECRET') ||
            config.get('REALTIME_WS_SECRET') ||
            process.env.WS_SHARED_SECRET ||
            process.env.REALTIME_WS_SECRET);
    }
    isEnabled() {
        return Boolean(this.secret);
    }
    validate(client, args) {
        if (!this.secret) {
            return true;
        }
        const provided = this.extractSignature(client, args);
        if (!provided) {
            this.logger.warn('Connexion WS refusee: signature absente.');
            return false;
        }
        return this.compare(this.secret, provided);
    }
    extractSignature(client, args) {
        const firstArg = args[0];
        const request = this.resolveRequest(client, firstArg);
        const urlCandidate = this.pickUrl(client, request);
        if (urlCandidate) {
            const trimmedUrl = urlCandidate.trim();
            if (trimmedUrl) {
                try {
                    const url = new URL(trimmedUrl, 'ws://localhost');
                    const fromQuery = url.searchParams.get('signature');
                    if (fromQuery && fromQuery.trim()) {
                        return fromQuery.trim();
                    }
                }
                catch {
                }
            }
        }
        const headers = client.handshakeHeaders ?? request?.headers;
        const headerSignature = this.extractHeaderSignature(headers);
        if (!headerSignature) {
            this.logger.warn('Connexion WS refusee: signature absente (query/header).');
        }
        return headerSignature;
    }
    extractHeaderSignature(headers) {
        if (!headers) {
            return null;
        }
        const candidates = [
            'x-lila-signature',
            'x-lila-ws-signature',
            'x-ws-signature',
            'x-signature',
        ];
        for (const key of candidates) {
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
        const raw = (typeof client.url === 'string' ? client.url : '') ||
            (typeof request?.url === 'string' ? request.url : '');
        const trimmed = raw.trim();
        return trimmed || null;
    }
    normalizeHeaderValue(raw) {
        if (!raw)
            return null;
        const value = Array.isArray(raw) ? raw[0] : raw;
        if (typeof value !== 'string')
            return null;
        const trimmed = value.trim();
        return trimmed || null;
    }
    compare(expected, provided) {
        const a = Buffer.from(expected, 'utf-8');
        const b = Buffer.from(provided, 'utf-8');
        if (a.length !== b.length) {
            return false;
        }
        try {
            return (0, crypto_1.timingSafeEqual)(a, b);
        }
        catch {
            return false;
        }
    }
    normalize(value) {
        if (!value) {
            return null;
        }
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }
};
exports.WsSignatureService = WsSignatureService;
exports.WsSignatureService = WsSignatureService = WsSignatureService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], WsSignatureService);
//# sourceMappingURL=ws-signature.service.js.map