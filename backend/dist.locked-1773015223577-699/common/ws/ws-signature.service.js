"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "WsSignatureService", {
    enumerable: true,
    get: function() {
        return WsSignatureService;
    }
});
const _common = require("@nestjs/common");
const _config = require("@nestjs/config");
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
let WsSignatureService = class WsSignatureService {
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
                } catch  {
                /* ignore invalid URL */ }
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
            'x-signature'
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
    compare(expected, provided) {
        const a = Buffer.from(expected, 'utf-8');
        const b = Buffer.from(provided, 'utf-8');
        if (a.length !== b.length) {
            return false;
        }
        try {
            return (0, _crypto.timingSafeEqual)(a, b);
        } catch  {
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
    constructor(config){
        this.logger = new _common.Logger(WsSignatureService.name);
        this.secret = this.normalize(config.get('WS_SHARED_SECRET') || config.get('REALTIME_WS_SECRET') || process.env.WS_SHARED_SECRET || process.env.REALTIME_WS_SECRET);
    }
};
WsSignatureService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _config.ConfigService === "undefined" ? Object : _config.ConfigService
    ])
], WsSignatureService);
