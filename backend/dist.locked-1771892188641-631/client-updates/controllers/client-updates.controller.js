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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientUpdatesController = void 0;
const common_1 = require("@nestjs/common");
const client_updates_service_1 = require("../services/client-updates.service");
const version_utils_1 = require("../../common/utils/version.utils");
let ClientUpdatesController = class ClientUpdatesController {
    updates;
    constructor(updates) {
        this.updates = updates;
    }
    getOrigin(req) {
        const hostHeader = req.headers['x-forwarded-host'] ||
            req.get('host');
        const host = (hostHeader || '').split(',')[0]?.trim();
        if (!host)
            return null;
        const protoHeader = req.headers['x-forwarded-proto'] || req.protocol;
        const proto = (protoHeader || '').split(',')[0]?.trim() || 'https';
        return `${proto}://${host}`;
    }
    async getVersion(current, req) {
        const latest = await this.updates.getLatest();
        const clickOnce = await this.updates.getPublishedClickOnceVersionFromDisk();
        const latestVersion = clickOnce ?? latest?.version ?? null;
        const minRequiredVersion = await this.updates.getMinRequiredVersion();
        const currentVersion = typeof current === 'string' ? current.trim() : null;
        const origin = req ? this.getOrigin(req) : null;
        const url = this.updates.resolveClientPublicUrlForOrigin(latest, origin);
        const updateAvailable = latestVersion && currentVersion
            ? (0, version_utils_1.isVersionGreater)(latestVersion, currentVersion)
            : null;
        const updateRequired = minRequiredVersion && currentVersion
            ? (0, version_utils_1.isVersionLower)(currentVersion, minRequiredVersion)
            : null;
        return {
            version: latestVersion,
            publishedAt: latest?.publishedAt ?? null,
            message: latest?.message ?? null,
            url,
            minRequiredVersion,
            current: currentVersion,
            updateAvailable,
            updateRequired,
        };
    }
};
exports.ClientUpdatesController = ClientUpdatesController;
__decorate([
    (0, common_1.Get)('client/version'),
    __param(0, (0, common_1.Query)('current')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ClientUpdatesController.prototype, "getVersion", null);
exports.ClientUpdatesController = ClientUpdatesController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [client_updates_service_1.ClientUpdatesService])
], ClientUpdatesController);
//# sourceMappingURL=client-updates.controller.js.map