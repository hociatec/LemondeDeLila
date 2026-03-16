"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ClientUpdatesController", {
    enumerable: true,
    get: function() {
        return ClientUpdatesController;
    }
});
const _common = require("@nestjs/common");
const _clientupdatesservice = require("../services/client-updates.service");
const _versionutils = require("../../common/utils/version.utils");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
function _ts_param(paramIndex, decorator) {
    return function(target, key) {
        decorator(target, key, paramIndex);
    };
}
let ClientUpdatesController = class ClientUpdatesController {
    getOrigin(req) {
        const hostHeader = req.headers['x-forwarded-host'] || req.get('host');
        const host = (hostHeader || '').split(',')[0]?.trim();
        if (!host) return null;
        const protoHeader = req.headers['x-forwarded-proto'] || req.protocol;
        const proto = (protoHeader || '').split(',')[0]?.trim() || 'https';
        return `${proto}://${host}`;
    }
    // Public endpoint used by clients (informational).
    async getVersion(current, req) {
        const latest = await this.updates.getLatest();
        // Prefer ClickOnce manifest version (what clients will actually download).
        const clickOnce = await this.updates.getPublishedClickOnceVersionFromDisk();
        const latestVersion = clickOnce ?? latest?.version ?? null;
        const minRequiredVersion = await this.updates.getMinRequiredVersion();
        const currentVersion = typeof current === 'string' ? current.trim() : null;
        const origin = req ? this.getOrigin(req) : null;
        const url = this.updates.resolveClientPublicUrlForOrigin(latest, origin);
        const updateAvailable = latestVersion && currentVersion ? (0, _versionutils.isVersionGreater)(latestVersion, currentVersion) : null;
        const updateRequired = minRequiredVersion && currentVersion ? (0, _versionutils.isVersionLower)(currentVersion, minRequiredVersion) : null;
        return {
            version: latestVersion,
            publishedAt: latest?.publishedAt ?? null,
            message: latest?.message ?? null,
            url,
            minRequiredVersion,
            current: currentVersion,
            updateAvailable,
            updateRequired
        };
    }
    constructor(updates){
        this.updates = updates;
    }
};
_ts_decorate([
    (0, _common.Get)('client/version'),
    _ts_param(0, (0, _common.Query)('current')),
    _ts_param(1, (0, _common.Req)()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        String,
        typeof Request === "undefined" ? Object : Request
    ]),
    _ts_metadata("design:returntype", Promise)
], ClientUpdatesController.prototype, "getVersion", null);
ClientUpdatesController = _ts_decorate([
    (0, _common.Controller)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _clientupdatesservice.ClientUpdatesService === "undefined" ? Object : _clientupdatesservice.ClientUpdatesService
    ])
], ClientUpdatesController);
