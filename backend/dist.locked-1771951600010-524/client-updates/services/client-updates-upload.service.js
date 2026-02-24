"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ClientUpdatesUploadService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientUpdatesUploadService = void 0;
const common_1 = require("@nestjs/common");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const version_utils_1 = require("../../common/utils/version.utils");
const client_updates_service_1 = require("./client-updates.service");
function getErrorMessage(value) {
    if (value instanceof Error && typeof value.message === 'string') {
        const message = value.message.trim();
        if (message) {
            return message;
        }
    }
    return 'erreur inconnue';
}
let ClientUpdatesUploadService = ClientUpdatesUploadService_1 = class ClientUpdatesUploadService {
    updates;
    logger = new common_1.Logger(ClientUpdatesUploadService_1.name);
    constructor(updates) {
        this.updates = updates;
    }
    uploadsRoot() {
        const override = (process.env.CLIENT_UPDATES_UPLOADS_DIR || '').trim();
        if (override) {
            return override;
        }
        const baseDir = path.dirname(this.updates.getTargetDir());
        return path.join(baseDir, 'uploads');
    }
    completedUploadsRoot() {
        return path.join(this.uploadsRoot(), '.completed');
    }
    completedMarkerPath(uploadId) {
        return path.join(this.completedUploadsRoot(), `${uploadId}.json`);
    }
    async readCompletedMarker(uploadId) {
        const markerPath = this.completedMarkerPath(uploadId);
        try {
            const raw = await fs.promises.readFile(markerPath, 'utf-8');
            const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
            if (!parsed || typeof parsed !== 'object')
                return null;
            if ((parsed.uploadId || '').trim() !== uploadId)
                return null;
            const meta = parsed.meta;
            if (!meta || typeof meta !== 'object')
                return null;
            if (typeof meta.version !== 'string' ||
                typeof meta.publishedAt !== 'string') {
                return null;
            }
            return {
                uploadId,
                completedAt: typeof parsed.completedAt === 'string'
                    ? parsed.completedAt
                    : new Date().toISOString(),
                meta: meta,
            };
        }
        catch {
            return null;
        }
    }
    async writeCompletedMarker(uploadId, meta) {
        const root = this.completedUploadsRoot();
        await fs.promises.mkdir(root, { recursive: true });
        const marker = {
            uploadId,
            completedAt: new Date().toISOString(),
            meta,
        };
        await fs.promises.writeFile(this.completedMarkerPath(uploadId), JSON.stringify(marker, null, 2));
    }
    async status() {
        const latest = await this.updates.getLatest();
        return {
            latest,
            targetDir: this.updates.getTargetDir(),
            publicUrl: this.updates.getPublicUrl(),
        };
    }
    normalizeVersion(input) {
        const v = typeof input === 'string' ? input.trim() : '';
        if (!v)
            return null;
        if ((0, version_utils_1.parseVersion)(v) == null) {
            throw new common_1.BadRequestException('Version invalide');
        }
        return v;
    }
    normalizeMinRequiredVersion(input) {
        const v = typeof input === 'string' ? input.trim() : '';
        if (!v)
            return null;
        if ((0, version_utils_1.parseVersion)(v) == null) {
            throw new common_1.BadRequestException('minRequiredVersion invalide');
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
            try {
                const published = await this.updates.getPublishedClickOnceVersionFromDisk();
                if (published) {
                    meta = { ...meta, version: published };
                }
            }
            catch {
            }
            await this.updates.saveLatest(meta);
        }
        catch (err) {
            const msg = getErrorMessage(err);
            throw new common_1.BadRequestException(`Publication echouee: ${msg}`);
        }
    }
    async uploadSingleZip(params) {
        const zipPath = params.zipPath;
        if (!zipPath || !fs.existsSync(zipPath)) {
            throw new common_1.BadRequestException('Fichier upload introuvable.');
        }
        const version = this.normalizeVersion(params.version) ?? `uploaded-${Date.now()}`;
        const message = this.normalizeMessage(params.message);
        const minRequiredVersion = this.normalizeMinRequiredVersion(params.minRequiredVersion);
        const meta = {
            version,
            publishedAt: new Date().toISOString(),
            message,
            publicUrl: this.updates.getPublicUrl(),
            minRequiredVersion,
        };
        await this.saveAndApplyZip(zipPath, meta);
        return { ok: true, meta };
    }
    async uploadInit(params) {
        const uploadId = (0, crypto_1.randomUUID)();
        const root = this.uploadsRoot();
        await fs.promises.mkdir(root, { recursive: true });
        const dir = path.join(root, uploadId);
        await fs.promises.mkdir(dir, { recursive: true });
        const meta = {
            uploadId,
            version: this.normalizeVersion(params.version),
            message: this.normalizeMessage(params.message),
            minRequiredVersion: this.normalizeMinRequiredVersion(params.minRequiredVersion),
            totalBytes: typeof params.totalBytes === 'number' &&
                Number.isFinite(params.totalBytes)
                ? params.totalBytes
                : null,
            createdAt: new Date().toISOString(),
            completedAt: null,
        };
        await fs.promises.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
        return { uploadId };
    }
    async uploadChunk(params) {
        const uploadId = (params.uploadId || '').trim();
        const index = params.index;
        if (!uploadId || !Number.isFinite(index) || index < 0) {
            throw new common_1.BadRequestException('uploadId/index invalides.');
        }
        if (!params.filePath || !fs.existsSync(params.filePath)) {
            throw new common_1.BadRequestException('Chunk manquant (champ "file").');
        }
        const dir = path.join(this.uploadsRoot(), uploadId);
        const metaPath = path.join(dir, 'meta.json');
        if (!fs.existsSync(metaPath)) {
            throw new common_1.BadRequestException(`Upload introuvable (uploadId=${uploadId}).`);
        }
        const partPath = path.join(dir, `${index}.part`);
        if (fs.existsSync(partPath)) {
            return { ok: true, duplicate: true };
        }
        await fs.promises.rename(params.filePath, partPath);
        return { ok: true };
    }
    async uploadComplete(params) {
        const uploadId = (params.uploadId || '').trim();
        if (!uploadId) {
            throw new common_1.BadRequestException('uploadId manquant.');
        }
        const dir = path.join(this.uploadsRoot(), uploadId);
        const metaPath = path.join(dir, 'meta.json');
        const completedMarker = await this.readCompletedMarker(uploadId);
        if (!fs.existsSync(metaPath)) {
            if (completedMarker) {
                return { ok: true, alreadyCompleted: true, meta: completedMarker.meta };
            }
            throw new common_1.BadRequestException(`Upload introuvable (uploadId=${uploadId}).`);
        }
        const lockPath = path.join(dir, '.complete.lock');
        let lockFd = null;
        try {
            lockFd = await fs.promises.open(lockPath, 'wx');
        }
        catch {
            throw new common_1.ConflictException('Finalisation déjà en cours.');
        }
        try {
            const metaRaw = await fs.promises.readFile(metaPath, 'utf-8');
            const meta = JSON.parse(metaRaw.replace(/^\uFEFF/, ''));
            if (meta.completedAt) {
                if (completedMarker) {
                    return {
                        ok: true,
                        alreadyCompleted: true,
                        meta: completedMarker.meta,
                    };
                }
                const fallbackMeta = {
                    version: meta.version || `uploaded-${Date.now()}`,
                    publishedAt: meta.completedAt || meta.createdAt || new Date().toISOString(),
                    message: meta.message || null,
                    publicUrl: this.updates.getPublicUrl(),
                    minRequiredVersion: meta.minRequiredVersion || null,
                };
                return { ok: true, alreadyCompleted: true, meta: fallbackMeta };
            }
            const parts = (await fs.promises.readdir(dir))
                .filter((f) => f.endsWith('.part'))
                .map((f) => ({
                name: f,
                index: Number.parseInt(f.replace('.part', ''), 10),
            }))
                .filter((p) => Number.isFinite(p.index))
                .sort((a, b) => a.index - b.index);
            if (parts.length === 0) {
                throw new common_1.BadRequestException('Aucun chunk reçu.');
            }
            for (let expected = 0; expected < parts.length; expected++) {
                if (parts[expected].index !== expected) {
                    throw new common_1.BadRequestException(`Chunks manquants ou index non-contigus (attendu ${expected}).`);
                }
            }
            const zipPath = path.join(os.tmpdir(), `lila-client-update-${uploadId}.zip`);
            const out = fs.createWriteStream(zipPath);
            const outDone = new Promise((resolve, reject) => {
                out.on('error', reject);
                out.on('finish', resolve);
            });
            let published = false;
            let markerWritten = false;
            try {
                for (const part of parts) {
                    const partPath = path.join(dir, part.name);
                    await new Promise((resolve, reject) => {
                        const input = fs.createReadStream(partPath);
                        input.on('error', reject);
                        input.on('end', resolve);
                        input.pipe(out, { end: false });
                    });
                }
                out.end();
                await outDone;
                const saved = {
                    version: meta.version || `uploaded-${Date.now()}`,
                    publishedAt: new Date().toISOString(),
                    message: meta.message || null,
                    publicUrl: this.updates.getPublicUrl(),
                    minRequiredVersion: meta.minRequiredVersion || null,
                };
                await this.saveAndApplyZip(zipPath, saved);
                const updatedMeta = {
                    ...meta,
                    completedAt: new Date().toISOString(),
                };
                await fs.promises.writeFile(metaPath, JSON.stringify(updatedMeta, null, 2));
                published = true;
                try {
                    await this.writeCompletedMarker(uploadId, saved);
                    markerWritten = true;
                }
                catch (err) {
                    this.logger.warn(`Impossible d'écrire le marqueur de finalisation uploadId=${uploadId}: ${getErrorMessage(err)}`);
                }
                return { ok: true, meta: saved };
            }
            finally {
                try {
                    out.destroy();
                }
                catch {
                }
                fs.promises.rm(zipPath, { force: true }).catch(() => {
                });
                if (published && markerWritten) {
                    fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {
                    });
                }
            }
        }
        finally {
            try {
                await lockFd?.close();
            }
            catch {
            }
            fs.promises.rm(lockPath, { force: true }).catch(() => {
            });
        }
    }
};
exports.ClientUpdatesUploadService = ClientUpdatesUploadService;
exports.ClientUpdatesUploadService = ClientUpdatesUploadService = ClientUpdatesUploadService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [client_updates_service_1.ClientUpdatesService])
], ClientUpdatesUploadService);
//# sourceMappingURL=client-updates-upload.service.js.map