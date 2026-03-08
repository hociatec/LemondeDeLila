"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AdminSoundsController", {
    enumerable: true,
    get: function() {
        return AdminSoundsController;
    }
});
const _common = require("@nestjs/common");
const _platformexpress = require("@nestjs/platform-express");
const _multer = require("multer");
const _os = /*#__PURE__*/ _interop_require_wildcard(require("os"));
const _httpjwtguard = require("../common/guards/http-jwt.guard");
const _adminroleguard = require("../common/guards/admin-role.guard");
const _soundsservice = require("./sounds.service");
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
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
let AdminSoundsController = class AdminSoundsController {
    async cleanup() {
        return this.sounds.cleanupUnusedSounds();
    }
    async reencodeAll() {
        return this.sounds.reencodeAllSounds();
    }
    async reencodeInvalid() {
        return this.sounds.reencodeInvalidSounds();
    }
    async diagnostic() {
        return this.sounds.diagnoseSounds();
    }
    async listTableAmbiences() {
        return this.sounds.listTableAmbiencesWithFilter({
            includeDisabled: true
        });
    }
    async createTableAmbience(body) {
        return this.sounds.createTableAmbience(body?.name);
    }
    async renameTableAmbience(soundId, body) {
        return this.sounds.renameTableAmbience(soundId, body?.name);
    }
    async deleteTableAmbience(soundId) {
        return this.sounds.deleteTableAmbience(soundId);
    }
    async setTableAmbienceEnabled(soundId, body) {
        if (typeof body?.enabled !== 'boolean') {
            throw new _common.BadRequestException('Champ "enabled" booléen requis.');
        }
        return this.sounds.setTableAmbienceEnabled(soundId, body.enabled === true);
    }
    async upload(soundId, file) {
        if (!file?.path) {
            throw new _common.BadRequestException('Fichier manquant (champ "file").');
        }
        try {
            const entry = await this.sounds.setSound(soundId, file.path, file.originalname);
            return {
                ok: true,
                sound: entry
            };
        } finally{
            try {
                // best-effort cleanup of temp file
                const fs = await Promise.resolve().then(()=>/*#__PURE__*/ _interop_require_wildcard(require("fs")));
                fs.promises.rm(file.path, {
                    force: true
                }).catch(()=>undefined);
            } catch  {
            // ignore
            }
        }
    }
    async clear(soundId) {
        return this.sounds.clearSound(soundId);
    }
    constructor(sounds){
        this.sounds = sounds;
    }
};
_ts_decorate([
    (0, _common.Post)('cleanup'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", Promise)
], AdminSoundsController.prototype, "cleanup", null);
_ts_decorate([
    (0, _common.Post)('reencode'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", Promise)
], AdminSoundsController.prototype, "reencodeAll", null);
_ts_decorate([
    (0, _common.Post)('reencode-invalid'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", Promise)
], AdminSoundsController.prototype, "reencodeInvalid", null);
_ts_decorate([
    (0, _common.Get)('diagnostic'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", Promise)
], AdminSoundsController.prototype, "diagnostic", null);
_ts_decorate([
    (0, _common.Get)('table-ambiences'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", Promise)
], AdminSoundsController.prototype, "listTableAmbiences", null);
_ts_decorate([
    (0, _common.Post)('table-ambiences'),
    _ts_param(0, (0, _common.Body)()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        Object
    ]),
    _ts_metadata("design:returntype", Promise)
], AdminSoundsController.prototype, "createTableAmbience", null);
_ts_decorate([
    (0, _common.Put)('table-ambiences/:soundId'),
    _ts_param(0, (0, _common.Param)('soundId')),
    _ts_param(1, (0, _common.Body)()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        String,
        Object
    ]),
    _ts_metadata("design:returntype", Promise)
], AdminSoundsController.prototype, "renameTableAmbience", null);
_ts_decorate([
    (0, _common.Delete)('table-ambiences/:soundId'),
    _ts_param(0, (0, _common.Param)('soundId')),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        String
    ]),
    _ts_metadata("design:returntype", Promise)
], AdminSoundsController.prototype, "deleteTableAmbience", null);
_ts_decorate([
    (0, _common.Put)('table-ambiences/:soundId/enabled'),
    _ts_param(0, (0, _common.Param)('soundId')),
    _ts_param(1, (0, _common.Body)()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        String,
        Object
    ]),
    _ts_metadata("design:returntype", Promise)
], AdminSoundsController.prototype, "setTableAmbienceEnabled", null);
_ts_decorate([
    (0, _common.Post)(':soundId'),
    (0, _common.UseInterceptors)((0, _platformexpress.FileInterceptor)('file', {
        storage: (0, _multer.diskStorage)({
            destination: (_req, _file, cb)=>cb(null, _os.tmpdir()),
            filename: (_req, file, cb)=>cb(null, `lila-sound-${Date.now()}-${file.originalname}`)
        }),
        // WAV files are much larger than MP3. Keep this generous; only admins can upload.
        limits: {
            fileSize: 250 * 1024 * 1024
        }
    })),
    _ts_param(0, (0, _common.Param)('soundId')),
    _ts_param(1, (0, _common.UploadedFile)()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        String,
        Object
    ]),
    _ts_metadata("design:returntype", Promise)
], AdminSoundsController.prototype, "upload", null);
_ts_decorate([
    (0, _common.Delete)(':soundId'),
    _ts_param(0, (0, _common.Param)('soundId')),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        String
    ]),
    _ts_metadata("design:returntype", Promise)
], AdminSoundsController.prototype, "clear", null);
AdminSoundsController = _ts_decorate([
    (0, _common.Controller)('api/admin/sounds'),
    (0, _common.UseGuards)(_httpjwtguard.HttpJwtGuard, _adminroleguard.AdminRoleGuard),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _soundsservice.SoundsService === "undefined" ? Object : _soundsservice.SoundsService
    ])
], AdminSoundsController);
