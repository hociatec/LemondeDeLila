"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "SoundsController", {
    enumerable: true,
    get: function() {
        return SoundsController;
    }
});
const _common = require("@nestjs/common");
const _soundsservice = require("./sounds.service");
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
const SOUND_FILE_SEND_OPTIONS = {
    // Production storage lives under ~/.local/share/..., and Express sendFile()
    // ignores dot-directories by default unless explicitly allowed.
    dotfiles: 'allow'
};
let SoundsController = class SoundsController {
    async manifest(req) {
        const xfProto = req.headers['x-forwarded-proto'];
        const xfHost = req.headers['x-forwarded-host'];
        const proto = typeof xfProto === 'string' && xfProto.trim() ? xfProto.split(',')[0].trim() : null;
        const host = typeof xfHost === 'string' && xfHost.trim() ? xfHost.split(',')[0].trim() : null;
        const origin = proto && host ? `${proto}://${host}` : host ? `https://${host}` : null;
        return this.sounds.getPublicManifest(origin);
    }
    async tableAmbiences() {
        return this.sounds.listTableAmbiencesWithFilter({
            includeDisabled: false
        });
    }
    async getSound(soundId, sha, res) {
        // Backward-compatible route: older clients requested .mp3. We now serve .wav by default.
        // If the server only has .wav, redirect so clients that can follow redirects still work.
        const { entry, filePath, ext } = await this.sounds.resolveSoundFile(soundId, sha);
        if (ext === '.wav') {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            res.setHeader('ETag', `"${entry.sha256}"`);
            return res.redirect(301, `/api/sounds/${encodeURIComponent(entry.soundId)}/${entry.sha256}.wav`);
        }
        // Helmet sets `Cross-Origin-Resource-Policy: same-origin` by default, which prevents
        // <audio> previews from working when the admin/front-end is hosted on a different origin.
        // Sounds are not sensitive; allow cross-origin loading for media playback.
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('ETag', `"${entry.sha256}"`);
        return res.sendFile(filePath, SOUND_FILE_SEND_OPTIONS);
    }
    async getSoundWav(soundId, sha, res) {
        const { entry, filePath } = await this.sounds.resolveSoundFile(soundId, sha);
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('ETag', `"${entry.sha256}"`);
        return res.sendFile(filePath, SOUND_FILE_SEND_OPTIONS);
    }
    constructor(sounds){
        this.sounds = sounds;
    }
};
_ts_decorate([
    (0, _common.Get)('manifest'),
    _ts_param(0, (0, _common.Req)()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof Request === "undefined" ? Object : Request
    ]),
    _ts_metadata("design:returntype", Promise)
], SoundsController.prototype, "manifest", null);
_ts_decorate([
    (0, _common.Get)('table-ambiences'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", Promise)
], SoundsController.prototype, "tableAmbiences", null);
_ts_decorate([
    (0, _common.Get)(':soundId/:sha.mp3'),
    _ts_param(0, (0, _common.Param)('soundId')),
    _ts_param(1, (0, _common.Param)('sha')),
    _ts_param(2, (0, _common.Res)()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        String,
        String,
        typeof Response === "undefined" ? Object : Response
    ]),
    _ts_metadata("design:returntype", Promise)
], SoundsController.prototype, "getSound", null);
_ts_decorate([
    (0, _common.Get)(':soundId/:sha.wav'),
    _ts_param(0, (0, _common.Param)('soundId')),
    _ts_param(1, (0, _common.Param)('sha')),
    _ts_param(2, (0, _common.Res)()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        String,
        String,
        typeof Response === "undefined" ? Object : Response
    ]),
    _ts_metadata("design:returntype", Promise)
], SoundsController.prototype, "getSoundWav", null);
SoundsController = _ts_decorate([
    (0, _common.Controller)('api/sounds'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _soundsservice.SoundsService === "undefined" ? Object : _soundsservice.SoundsService
    ])
], SoundsController);
