"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CiClientUpdatesController", {
    enumerable: true,
    get: function() {
        return CiClientUpdatesController;
    }
});
const _common = require("@nestjs/common");
const _platformexpress = require("@nestjs/platform-express");
const _fs = /*#__PURE__*/ _interop_require_wildcard(require("fs"));
const _os = /*#__PURE__*/ _interop_require_wildcard(require("os"));
const _clientupdatesuploadtokenguard = require("../guards/client-updates-upload-token.guard");
const _clientupdatesuploaddto = require("../dto/client-updates-upload.dto");
const _clientupdatesuploadservice = require("../services/client-updates-upload.service");
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
function getUploadPath(file) {
    return typeof file?.path === 'string' ? file.path : '';
}
let CiClientUpdatesController = class CiClientUpdatesController {
    async status() {
        return this.uploads.status();
    }
    async upload(file, body) {
        const zipPath = getUploadPath(file);
        if (!zipPath) {
            throw new _common.BadRequestException('Fichier manquant (champ "file").');
        }
        try {
            return await this.uploads.uploadSingleZip({
                zipPath,
                version: body?.version,
                message: body?.message,
                minRequiredVersion: body?.minRequiredVersion
            });
        } finally{
            _fs.promises.rm(zipPath, {
                force: true
            }).catch(()=>{
            /* ignore */ });
        }
    }
    async init(body) {
        return this.uploads.uploadInit(body);
    }
    async chunk(file, body) {
        const filePath = getUploadPath(file);
        if (!filePath) {
            throw new _common.BadRequestException('Chunk manquant (champ "file").');
        }
        return this.uploads.uploadChunk({
            uploadId: body?.uploadId ?? '',
            index: body?.index ?? -1,
            filePath
        });
    }
    async complete(body) {
        return this.uploads.uploadComplete({
            uploadId: body.uploadId
        });
    }
    constructor(uploads){
        this.uploads = uploads;
    }
};
_ts_decorate([
    (0, _common.Get)('status'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", Promise)
], CiClientUpdatesController.prototype, "status", null);
_ts_decorate([
    (0, _common.Post)('upload'),
    (0, _common.UseInterceptors)((0, _platformexpress.FileInterceptor)('file', {
        dest: _os.tmpdir(),
        limits: {
            fileSize: 600 * 1024 * 1024
        }
    })),
    _ts_param(0, (0, _common.UploadedFile)()),
    _ts_param(1, (0, _common.Body)()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof UploadedFileLike === "undefined" ? Object : UploadedFileLike,
        typeof _clientupdatesuploaddto.ClientUpdatesUploadMetaDto === "undefined" ? Object : _clientupdatesuploaddto.ClientUpdatesUploadMetaDto
    ]),
    _ts_metadata("design:returntype", Promise)
], CiClientUpdatesController.prototype, "upload", null);
_ts_decorate([
    (0, _common.Post)('upload/init'),
    _ts_param(0, (0, _common.Body)()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _clientupdatesuploaddto.ClientUpdatesUploadInitDto === "undefined" ? Object : _clientupdatesuploaddto.ClientUpdatesUploadInitDto
    ]),
    _ts_metadata("design:returntype", Promise)
], CiClientUpdatesController.prototype, "init", null);
_ts_decorate([
    (0, _common.Post)('upload/chunk'),
    (0, _common.UseInterceptors)((0, _platformexpress.FileInterceptor)('file', {
        dest: _os.tmpdir(),
        limits: {
            fileSize: 15 * 1024 * 1024
        }
    })),
    _ts_param(0, (0, _common.UploadedFile)()),
    _ts_param(1, (0, _common.Body)()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof UploadedFileLike === "undefined" ? Object : UploadedFileLike,
        typeof _clientupdatesuploaddto.ClientUpdatesUploadChunkDto === "undefined" ? Object : _clientupdatesuploaddto.ClientUpdatesUploadChunkDto
    ]),
    _ts_metadata("design:returntype", Promise)
], CiClientUpdatesController.prototype, "chunk", null);
_ts_decorate([
    (0, _common.Post)('upload/complete'),
    _ts_param(0, (0, _common.Body)()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _clientupdatesuploaddto.ClientUpdatesUploadCompleteDto === "undefined" ? Object : _clientupdatesuploaddto.ClientUpdatesUploadCompleteDto
    ]),
    _ts_metadata("design:returntype", Promise)
], CiClientUpdatesController.prototype, "complete", null);
CiClientUpdatesController = _ts_decorate([
    (0, _common.Controller)('api/ci/client-updates'),
    (0, _common.UseGuards)(_clientupdatesuploadtokenguard.ClientUpdatesUploadTokenGuard),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _clientupdatesuploadservice.ClientUpdatesUploadService === "undefined" ? Object : _clientupdatesuploadservice.ClientUpdatesUploadService
    ])
], CiClientUpdatesController);
