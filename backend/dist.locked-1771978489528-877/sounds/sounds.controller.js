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
exports.SoundsController = void 0;
const common_1 = require("@nestjs/common");
const sounds_service_1 = require("./sounds.service");
let SoundsController = class SoundsController {
    sounds;
    constructor(sounds) {
        this.sounds = sounds;
    }
    async manifest(req) {
        const xfProto = req.headers['x-forwarded-proto'];
        const xfHost = req.headers['x-forwarded-host'];
        const proto = typeof xfProto === 'string' && xfProto.trim()
            ? xfProto.split(',')[0].trim()
            : null;
        const host = typeof xfHost === 'string' && xfHost.trim()
            ? xfHost.split(',')[0].trim()
            : null;
        const origin = proto && host ? `${proto}://${host}` : host ? `https://${host}` : null;
        return this.sounds.getPublicManifest(origin);
    }
    async tableAmbiences() {
        return this.sounds.listTableAmbiences();
    }
    async getSound(soundId, sha, res) {
        const { entry, filePath, ext } = await this.sounds.resolveSoundFile(soundId, sha);
        if (ext === '.wav') {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            res.setHeader('ETag', `"${entry.sha256}"`);
            return res.redirect(301, `/api/sounds/${encodeURIComponent(entry.soundId)}/${entry.sha256}.wav`);
        }
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('ETag', `"${entry.sha256}"`);
        return res.sendFile(filePath);
    }
    async getSoundWav(soundId, sha, res) {
        const { entry, filePath } = await this.sounds.resolveSoundFile(soundId, sha);
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('ETag', `"${entry.sha256}"`);
        return res.sendFile(filePath);
    }
};
exports.SoundsController = SoundsController;
__decorate([
    (0, common_1.Get)('manifest'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SoundsController.prototype, "manifest", null);
__decorate([
    (0, common_1.Get)('table-ambiences'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SoundsController.prototype, "tableAmbiences", null);
__decorate([
    (0, common_1.Get)(':soundId/:sha.mp3'),
    __param(0, (0, common_1.Param)('soundId')),
    __param(1, (0, common_1.Param)('sha')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], SoundsController.prototype, "getSound", null);
__decorate([
    (0, common_1.Get)(':soundId/:sha.wav'),
    __param(0, (0, common_1.Param)('soundId')),
    __param(1, (0, common_1.Param)('sha')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], SoundsController.prototype, "getSoundWav", null);
exports.SoundsController = SoundsController = __decorate([
    (0, common_1.Controller)('api/sounds'),
    __metadata("design:paramtypes", [sounds_service_1.SoundsService])
], SoundsController);
//# sourceMappingURL=sounds.controller.js.map