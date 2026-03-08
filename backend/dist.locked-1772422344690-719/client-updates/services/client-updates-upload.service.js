"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ClientUpdatesUploadService", {
    enumerable: true,
    get: function() {
        return ClientUpdatesUploadService;
    }
});
const _common = require("@nestjs/common");
const _fs = /*#__PURE__*/ _interop_require_wildcard(require("fs"));
const _os = /*#__PURE__*/ _interop_require_wildcard(require("os"));
const _path = /*#__PURE__*/ _interop_require_wildcard(require("path"));
const _crypto = require("crypto");
const _versionutils = require("../../common/utils/version.utils");
const _clientupdatesservice = require("./client-updates.service");
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
function getErrorMessage(value) {
    if (value instanceof Error && typeof value.message === 'string') {
        const message = value.message.trim();
        if (message) {
            return message;
        }
    }
    return 'erreur inconnue';
}
let ClientUpdatesUploadService = class ClientUpdatesUploadService {
    uploadsRoot() {
        const override = (process.env.CLIENT_UPDATES_UPLOADS_DIR || '').trim();
        if (override) {
            return override;
        }
        const baseDir = _path.dirname(this.updates.getTargetDir());
        return _path.join(baseDir, 'uploads');
    }
    completedUploadsRoot() {
        return _path.join(this.uploadsRoot(), '.completed');
    }
    completedMarkerPath(uploadId) {
        return _path.join(this.completedUploadsRoot(), `${uploadId}.json`);
    }
    async readCompletedMarker(uploadId) {
        const markerPath = this.completedMarkerPath(uploadId);
        try {
            const raw = await _fs.promises.readFile(markerPath, 'utf-8');
            const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
            if (!parsed || typeof parsed !== 'object') return null;
            if ((parsed.uploadId || '').trim() !== uploadId) return null;
            const meta = parsed.meta;
            if (!meta || typeof meta !== 'object') return null;
            if (typeof meta.version !== 'string' || typeof meta.publishedAt !== 'string') {
                return null;
            }
            return {
                uploadId,
                completedAt: typeof parsed.completedAt === 'string' ? parsed.completedAt : new Date().toISOString(),
                meta: meta
            };
        } catch  {
            return null;
        }
    }
    async writeCompletedMarker(uploadId, meta) {
        const root = this.completedUploadsRoot();
        await _fs.promises.mkdir(root, {
            recursive: true
        });
        const marker = {
            uploadId,
            completedAt: new Date().toISOString(),
            meta
        };
        await _fs.promises.writeFile(this.completedMarkerPath(uploadId), JSON.stringify(marker, null, 2));
    }
    async status() {
        const latest = await this.updates.getLatest();
        return {
            latest,
            targetDir: this.updates.getTargetDir(),
            publicUrl: this.updates.getPublicUrl()
        };
    }
    normalizeVersion(input) {
        const v = typeof input === 'string' ? input.trim() : '';
        if (!v) return null;
        if ((0, _versionutils.parseVersion)(v) == null) {
            throw new _common.BadRequestException('Version invalide');
        }
        return v;
    }
    normalizeMinRequiredVersion(input) {
        const v = typeof input === 'string' ? input.trim() : '';
        if (!v) return null;
        if ((0, _versionutils.parseVersion)(v) == null) {
            throw new _common.BadRequestException('minRequiredVersion invalide');
        }
        return v;
    }
    normalizeMessage(input) {
        const m = typeof input === 'string' ? input.trim() : '';
        return m ? m : null;
    }
    async saveAndApplyZip(zipPath, meta) {
        try {
            await this.updates.applyZip(zipPath);
            // Ensure /client/version reflects the actual ClickOnce version being served,
            // even if the uploader didn't pass a version (or passed a placeholder).
            try {
                const published = await this.updates.getPublishedClickOnceVersionFromDisk();
                if (published) {
                    meta = {
                        ...meta,
                        version: published
                    };
                }
            } catch  {
            // Best-effort
            }
            await this.updates.saveLatest(meta);
        } catch (err) {
            const msg = getErrorMessage(err);
            throw new _common.BadRequestException(`Publication echouee: ${msg}`);
        }
    }
    async uploadSingleZip(params) {
        const zipPath = params.zipPath;
        if (!zipPath || !_fs.existsSync(zipPath)) {
            throw new _common.BadRequestException('Fichier upload introuvable.');
        }
        const version = this.normalizeVersion(params.version) ?? `uploaded-${Date.now()}`;
        const message = this.normalizeMessage(params.message);
        const minRequiredVersion = this.normalizeMinRequiredVersion(params.minRequiredVersion);
        const meta = {
            version,
            publishedAt: new Date().toISOString(),
            message,
            publicUrl: this.updates.getPublicUrl(),
            minRequiredVersion
        };
        await this.saveAndApplyZip(zipPath, meta);
        return {
            ok: true,
            meta
        };
    }
    async uploadInit(params) {
        const uploadId = (0, _crypto.randomUUID)();
        const root = this.uploadsRoot();
        await _fs.promises.mkdir(root, {
            recursive: true
        });
        const dir = _path.join(root, uploadId);
        await _fs.promises.mkdir(dir, {
            recursive: true
        });
        const meta = {
            uploadId,
            version: this.normalizeVersion(params.version),
            message: this.normalizeMessage(params.message),
            minRequiredVersion: this.normalizeMinRequiredVersion(params.minRequiredVersion),
            totalBytes: typeof params.totalBytes === 'number' && Number.isFinite(params.totalBytes) ? params.totalBytes : null,
            createdAt: new Date().toISOString(),
            completedAt: null
        };
        await _fs.promises.writeFile(_path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
        return {
            uploadId
        };
    }
    async uploadChunk(params) {
        const uploadId = (params.uploadId || '').trim();
        const index = params.index;
        if (!uploadId || !Number.isFinite(index) || index < 0) {
            throw new _common.BadRequestException('uploadId/index invalides.');
        }
        if (!params.filePath || !_fs.existsSync(params.filePath)) {
            throw new _common.BadRequestException('Chunk manquant (champ "file").');
        }
        const dir = _path.join(this.uploadsRoot(), uploadId);
        const metaPath = _path.join(dir, 'meta.json');
        if (!_fs.existsSync(metaPath)) {
            throw new _common.BadRequestException(`Upload introuvable (uploadId=${uploadId}).`);
        }
        const partPath = _path.join(dir, `${index}.part`);
        if (_fs.existsSync(partPath)) {
            // Idempotent behavior: allows client/workflow retries without failing the whole upload.
            return {
                ok: true,
                duplicate: true
            };
        }
        await _fs.promises.rename(params.filePath, partPath);
        return {
            ok: true
        };
    }
    async uploadComplete(params) {
        const uploadId = (params.uploadId || '').trim();
        if (!uploadId) {
            throw new _common.BadRequestException('uploadId manquant.');
        }
        const dir = _path.join(this.uploadsRoot(), uploadId);
        const metaPath = _path.join(dir, 'meta.json');
        const completedMarker = await this.readCompletedMarker(uploadId);
        if (!_fs.existsSync(metaPath)) {
            if (completedMarker) {
                return {
                    ok: true,
                    alreadyCompleted: true,
                    meta: completedMarker.meta
                };
            }
            throw new _common.BadRequestException(`Upload introuvable (uploadId=${uploadId}).`);
        }
        const lockPath = _path.join(dir, '.complete.lock');
        let lockFd = null;
        try {
            lockFd = await _fs.promises.open(lockPath, 'wx');
        } catch  {
            throw new _common.ConflictException('Finalisation déjà en cours.');
        }
        try {
            const metaRaw = await _fs.promises.readFile(metaPath, 'utf-8');
            const meta = JSON.parse(metaRaw.replace(/^\uFEFF/, ''));
            if (meta.completedAt) {
                if (completedMarker) {
                    return {
                        ok: true,
                        alreadyCompleted: true,
                        meta: completedMarker.meta
                    };
                }
                const fallbackMeta = {
                    version: meta.version || `uploaded-${Date.now()}`,
                    publishedAt: meta.completedAt || meta.createdAt || new Date().toISOString(),
                    message: meta.message || null,
                    publicUrl: this.updates.getPublicUrl(),
                    minRequiredVersion: meta.minRequiredVersion || null
                };
                return {
                    ok: true,
                    alreadyCompleted: true,
                    meta: fallbackMeta
                };
            }
            const parts = (await _fs.promises.readdir(dir)).filter((f)=>f.endsWith('.part')).map((f)=>({
                    name: f,
                    index: Number.parseInt(f.replace('.part', ''), 10)
                })).filter((p)=>Number.isFinite(p.index)).sort((a, b)=>a.index - b.index);
            if (parts.length === 0) {
                throw new _common.BadRequestException('Aucun chunk reçu.');
            }
            for(let expected = 0; expected < parts.length; expected++){
                if (parts[expected].index !== expected) {
                    throw new _common.BadRequestException(`Chunks manquants ou index non-contigus (attendu ${expected}).`);
                }
            }
            const zipPath = _path.join(_os.tmpdir(), `lila-client-update-${uploadId}.zip`);
            const out = _fs.createWriteStream(zipPath);
            const outDone = new Promise((resolve, reject)=>{
                out.on('error', reject);
                out.on('finish', resolve);
            });
            let published = false;
            let markerWritten = false;
            try {
                for (const part of parts){
                    const partPath = _path.join(dir, part.name);
                    await new Promise((resolve, reject)=>{
                        const input = _fs.createReadStream(partPath);
                        input.on('error', reject);
                        input.on('end', resolve);
                        input.pipe(out, {
                            end: false
                        });
                    });
                }
                out.end();
                await outDone;
                const saved = {
                    version: meta.version || `uploaded-${Date.now()}`,
                    publishedAt: new Date().toISOString(),
                    message: meta.message || null,
                    publicUrl: this.updates.getPublicUrl(),
                    minRequiredVersion: meta.minRequiredVersion || null
                };
                await this.saveAndApplyZip(zipPath, saved);
                const updatedMeta = {
                    ...meta,
                    completedAt: new Date().toISOString()
                };
                await _fs.promises.writeFile(metaPath, JSON.stringify(updatedMeta, null, 2));
                published = true;
                try {
                    await this.writeCompletedMarker(uploadId, saved);
                    markerWritten = true;
                } catch (err) {
                    this.logger.warn(`Impossible d'écrire le marqueur de finalisation uploadId=${uploadId}: ${getErrorMessage(err)}`);
                }
                return {
                    ok: true,
                    meta: saved
                };
            } finally{
                try {
                    out.destroy();
                } catch  {
                /* ignore */ }
                _fs.promises.rm(zipPath, {
                    force: true
                }).catch(()=>{
                /* ignore */ });
                if (published && markerWritten) {
                    _fs.promises.rm(dir, {
                        recursive: true,
                        force: true
                    }).catch(()=>{
                    /* ignore */ });
                }
            }
        } finally{
            try {
                await lockFd?.close();
            } catch  {
            /* ignore */ }
            _fs.promises.rm(lockPath, {
                force: true
            }).catch(()=>{
            /* ignore */ });
        }
    }
    constructor(updates){
        this.updates = updates;
        this.logger = new _common.Logger(ClientUpdatesUploadService.name);
    }
};
ClientUpdatesUploadService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _clientupdatesservice.ClientUpdatesService === "undefined" ? Object : _clientupdatesservice.ClientUpdatesService
    ])
], ClientUpdatesUploadService);
