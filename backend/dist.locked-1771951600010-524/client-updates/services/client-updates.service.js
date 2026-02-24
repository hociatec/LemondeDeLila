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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientUpdatesService = void 0;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const common_1 = require("@nestjs/common");
const version_utils_1 = require("../../common/utils/version.utils");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
let ClientUpdatesService = class ClientUpdatesService {
    updatesDir;
    metaPath;
    legacyApplicationName = 'client-win.application';
    latestZipName = 'client-win.zip';
    latestMeta = undefined;
    latestMetaMtimeMs = null;
    hasDirectoryEntries(dir) {
        try {
            return fs.readdirSync(dir).length > 0;
        }
        catch {
            return false;
        }
    }
    bootstrapPersistentStorage(legacyDataDir, persistentDataDir) {
        if (path.resolve(legacyDataDir) === path.resolve(persistentDataDir)) {
            return;
        }
        try {
            const legacyClientDir = path.join(legacyDataDir, 'client-win');
            const persistentClientDir = path.join(persistentDataDir, 'client-win');
            const legacyMeta = path.join(legacyDataDir, 'latest.json');
            const persistentMeta = path.join(persistentDataDir, 'latest.json');
            if (!this.hasDirectoryEntries(persistentClientDir) &&
                this.hasDirectoryEntries(legacyClientDir)) {
                fs.mkdirSync(path.dirname(persistentClientDir), { recursive: true });
                fs.cpSync(legacyClientDir, persistentClientDir, {
                    recursive: true,
                    force: false,
                    errorOnExist: false,
                });
            }
            if (!fs.existsSync(persistentMeta) && fs.existsSync(legacyMeta)) {
                fs.mkdirSync(path.dirname(persistentMeta), { recursive: true });
                fs.copyFileSync(legacyMeta, persistentMeta);
            }
        }
        catch {
        }
    }
    constructor() {
        const backendRoot = path.resolve(__dirname, '..', '..', '..');
        const legacyDataDir = path.join(backendRoot, 'data', 'client-updates');
        const nodeEnv = (process.env.NODE_ENV || '').trim().toLowerCase();
        const defaultDataDir = nodeEnv === 'production'
            ? path.join(os.homedir(), '.local', 'share', 'lemonde-de-lila', 'client-updates')
            : legacyDataDir;
        const defaultUpdatesDir = path.join(defaultDataDir, 'client-win');
        if (nodeEnv === 'production' &&
            !process.env.CLIENT_UPDATES_DIR &&
            !process.env.CLIENT_UPDATES_META_PATH) {
            this.bootstrapPersistentStorage(legacyDataDir, defaultDataDir);
        }
        this.updatesDir = process.env.CLIENT_UPDATES_DIR || defaultUpdatesDir;
        this.metaPath =
            process.env.CLIENT_UPDATES_META_PATH ||
                path.join(defaultDataDir, 'latest.json');
    }
    getTargetDir() {
        return this.updatesDir;
    }
    getPublicUrl() {
        return process.env.CLIENT_UPDATES_PUBLIC_URL || null;
    }
    resolveClientPublicUrl(latest) {
        const explicit = (latest?.publicUrl || '').trim();
        if (explicit) {
            return explicit;
        }
        const base = (this.getPublicUrl() || '').trim();
        if (!base)
            return null;
        return base;
    }
    resolveClientPublicUrlForOrigin(latest, origin) {
        const resolved = this.resolveClientPublicUrl(latest);
        if (resolved) {
            if (resolved.startsWith('http://') ||
                resolved.startsWith('https://') ||
                resolved.startsWith('ms-appx://')) {
                return resolved;
            }
            if (origin && resolved.startsWith('/')) {
                return `${origin.replace(/\/$/, '')}${resolved}`;
            }
            return resolved;
        }
        if (!origin)
            return null;
        const base = origin.replace(/\/$/, '');
        return `${base}/updates/client-win/`;
    }
    async getPublishedClickOnceVersionFromDisk() {
        const targetDir = this.getTargetDir();
        const candidates = [
            path.join(targetDir, 'LeMondeDeLila.application'),
            path.join(targetDir, this.legacyApplicationName),
        ];
        for (const file of candidates) {
            try {
                if (!fs.existsSync(file))
                    continue;
                const raw = await fs.promises.readFile(file, 'utf-8');
                const text = raw.replace(/^\uFEFF/, '');
                const m = text.match(/assemblyIdentity[^>]*version="(?<v>[0-9.]+)"/i);
                const v = (m?.groups?.v || '').trim();
                if (!v)
                    continue;
                if ((0, version_utils_1.parseVersion)(v) == null)
                    continue;
                return v;
            }
            catch {
            }
        }
        return null;
    }
    async writeLandingPage(targetDir) {
        const zipExists = fs.existsSync(path.join(targetDir, this.latestZipName));
        const entries = await fs.promises.readdir(targetDir, {
            withFileTypes: true,
        });
        const application = entries
            .filter((e) => e.isFile())
            .map((e) => e.name)
            .find((name) => name.toLowerCase().endsWith('.application'));
        const links = [];
        if (zipExists) {
            links.push({
                href: this.latestZipName,
                label: 'Télécharger (ZIP)',
                note: 'Version portable (à extraire).',
            });
        }
        if (application) {
            links.push({
                href: application,
                label: 'Installer / Mettre à jour (ClickOnce)',
                note: 'Si vous utilisez ClickOnce.',
            });
        }
        const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Le Monde de Lila – Mise à jour</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 24px; max-width: 760px; margin: 0 auto; }
      h1 { margin: 0 0 8px; }
      .muted { color: #666; }
      .card { border: 1px solid #e5e5e5; border-radius: 12px; padding: 16px; margin-top: 16px; }
      a.btn { display: inline-block; padding: 10px 14px; border-radius: 10px; background: #111; color: #fff; text-decoration: none; }
      a.btn.secondary { background: #2b2b2b; }
      .note { margin-top: 8px; color: #666; font-size: 14px; }
      code { background: #f5f5f5; padding: 2px 6px; border-radius: 6px; }
    </style>
  </head>
  <body>
    <h1>Mise à jour du client</h1>
    <div class="muted">Téléchargez la dernière version du client Windows.</div>
    <div class="card">
      ${links.length > 0
            ? links
                .map((l, idx) => `<div style="margin-top: ${idx === 0 ? 0 : 12}px;">
                     <a class="btn ${idx === 0 ? '' : 'secondary'}" href="${l.href}">${l.label}</a>
                     ${l.note ? `<div class="note">${l.note}</div>` : ''}
                   </div>`)
                .join('\n')
            : '<div>Aucun package disponible pour le moment.</div>'}
      <div class="note" style="margin-top: 16px;">
        Si l’application vous indique qu’une mise à jour est requise, installez la dernière version puis relancez.
      </div>
    </div>
  </body>
</html>`;
        await fs.promises.writeFile(path.join(targetDir, 'index.html'), html, 'utf-8');
    }
    async getLatest() {
        try {
            const stats = await fs.promises.stat(this.metaPath);
            const mtimeMs = stats.mtimeMs;
            if (this.latestMeta &&
                this.latestMetaMtimeMs != null &&
                this.latestMetaMtimeMs === mtimeMs) {
                return this.latestMeta;
            }
            const raw = await fs.promises.readFile(this.metaPath, 'utf-8');
            const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
            this.latestMeta = parsed;
            this.latestMetaMtimeMs = mtimeMs;
            return parsed;
        }
        catch (error) {
            const errno = error?.code ?? '';
            if (errno === 'ENOENT') {
                this.latestMeta = null;
                this.latestMetaMtimeMs = null;
                return null;
            }
            if (this.latestMeta !== undefined) {
                return this.latestMeta;
            }
            this.latestMeta = null;
            this.latestMetaMtimeMs = null;
            return null;
        }
    }
    async saveLatest(meta) {
        const dir = path.dirname(this.metaPath);
        await fs.promises.mkdir(dir, { recursive: true });
        await fs.promises.writeFile(this.metaPath, JSON.stringify(meta, null, 2));
        this.latestMeta = meta;
        try {
            const stats = await fs.promises.stat(this.metaPath);
            this.latestMetaMtimeMs = stats.mtimeMs;
        }
        catch {
            this.latestMetaMtimeMs = Date.now();
        }
    }
    async getMinRequiredVersion() {
        const env = (process.env.CLIENT_MIN_VERSION || '').trim();
        const latest = await this.getLatest();
        const forceLatestRaw = (process.env.CLIENT_FORCE_LATEST || '')
            .trim()
            .toLowerCase();
        const forceLatest = forceLatestRaw === '1' ||
            forceLatestRaw === 'true' ||
            forceLatestRaw === 'yes' ||
            forceLatestRaw === 'y';
        const metaMin = (latest?.minRequiredVersion || '').trim();
        const publishedClickOnce = await this.getPublishedClickOnceVersionFromDisk();
        const hasClickOnce = Boolean(publishedClickOnce && (0, version_utils_1.parseVersion)(publishedClickOnce) != null);
        const latestAsMin = forceLatest && hasClickOnce ? (publishedClickOnce || '').trim() : '';
        const candidates = [env, metaMin, latestAsMin].filter((v) => Boolean(v));
        if (candidates.length === 0)
            return null;
        if (candidates.length === 1)
            return candidates[0] || null;
        const parsed = candidates
            .map((v) => ({ v, p: (0, version_utils_1.parseVersion)(v) }))
            .filter((x) => x.p != null);
        if (parsed.length === 0) {
            return env || metaMin || latestAsMin || null;
        }
        parsed.sort((a, b) => b.p - a.p);
        if (hasClickOnce) {
            const clickOncePacked = (0, version_utils_1.parseVersion)(publishedClickOnce);
            if (clickOncePacked != null && parsed[0].p > clickOncePacked) {
                return publishedClickOnce;
            }
            return parsed[0].v;
        }
        return env || null;
    }
    async assertZipSafe(zipPath) {
        await this.assertUnzipAvailable();
        const { stdout } = await execFileAsync('unzip', ['-Z1', zipPath], {
            timeout: 60_000,
            maxBuffer: 50 * 1024 * 1024,
        });
        const entries = stdout
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);
        for (const entry of entries) {
            if (entry.startsWith('/') ||
                entry.startsWith('\\') ||
                entry.includes('..') ||
                entry.includes(':') ||
                entry.includes('\\')) {
                throw new Error(`Archive invalide (entrée non sûre): ${entry}`);
            }
        }
    }
    async assertUnzipAvailable() {
        try {
            await execFileAsync('unzip', ['-v'], { timeout: 10_000 });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : '';
            if (msg.includes('ENOENT')) {
                throw new Error('Dépendance manquante: commande "unzip" introuvable (installez le paquet unzip).');
            }
            throw err;
        }
    }
    async replaceDirectoryContents(srcDir, dstDir) {
        await fs.promises.mkdir(dstDir, { recursive: true });
        const existing = await fs.promises.readdir(dstDir, { withFileTypes: true });
        for (const e of existing) {
            await fs.promises.rm(path.join(dstDir, e.name), {
                recursive: true,
                force: true,
            });
        }
        const copyRecursive = async (from, to) => {
            const st = await fs.promises.stat(from);
            if (st.isDirectory()) {
                await fs.promises.mkdir(to, { recursive: true });
                const entries = await fs.promises.readdir(from, {
                    withFileTypes: true,
                });
                for (const e of entries) {
                    await copyRecursive(path.join(from, e.name), path.join(to, e.name));
                }
                return;
            }
            await fs.promises.mkdir(path.dirname(to), { recursive: true });
            await fs.promises.copyFile(from, to);
        };
        await copyRecursive(srcDir, dstDir);
    }
    async applyZip(zipPath) {
        await this.assertZipSafe(zipPath);
        const baseTmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'lila-client-update-'));
        const stagingDir = path.join(baseTmp, 'staging');
        await fs.promises.mkdir(stagingDir, { recursive: true });
        await execFileAsync('unzip', ['-o', zipPath, '-d', stagingDir], {
            timeout: 10 * 60_000,
            maxBuffer: 50 * 1024 * 1024,
        });
        const stagingEntries = await fs.promises.readdir(stagingDir, {
            withFileTypes: true,
        });
        const extractedApplication = stagingEntries
            .filter((e) => e.isFile())
            .map((e) => e.name)
            .find((name) => name.toLowerCase().endsWith('.application'));
        if (!extractedApplication) {
            throw new Error('Archive invalide : manifeste ClickOnce (.application) manquant.');
        }
        const applicationFilesDir = stagingEntries
            .filter((e) => e.isDirectory())
            .map((e) => e.name)
            .find((name) => name === 'Application Files');
        if (!applicationFilesDir) {
            throw new Error('Archive invalide : dossier "Application Files" introuvable.');
        }
        const targetDir = this.getTargetDir();
        const parent = path.dirname(targetDir);
        const releasesDir = path.join(parent, 'client-win.releases');
        await fs.promises.mkdir(releasesDir, { recursive: true });
        const backupDir = path.join(releasesDir, `backup.${Date.now()}`);
        let published = false;
        const resolveExistingTarget = async () => {
            try {
                const existing = await fs.promises.lstat(targetDir);
                if (existing.isDirectory()) {
                    return targetDir;
                }
                if (existing.isSymbolicLink()) {
                    let resolved = null;
                    try {
                        const realPath = await fs.promises.realpath(targetDir);
                        const realStats = await fs.promises.lstat(realPath);
                        if (realStats.isDirectory()) {
                            resolved = realPath;
                        }
                    }
                    catch {
                    }
                    await fs.promises.unlink(targetDir).catch(() => {
                    });
                    return resolved;
                }
            }
            catch {
            }
            return null;
        };
        try {
            const existingTargetPath = await resolveExistingTarget();
            if (existingTargetPath) {
                await fs.promises.rename(existingTargetPath, backupDir);
                await fs.promises.rename(stagingDir, targetDir);
                published = true;
            }
        }
        catch {
        }
        if (!published) {
            await this.replaceDirectoryContents(stagingDir, targetDir);
            published = true;
        }
        await this.ensureLegacyAliases(targetDir);
        try {
            const zipDest = path.join(targetDir, this.latestZipName);
            await fs.promises.copyFile(zipPath, zipDest);
        }
        catch {
        }
        try {
            await this.writeLandingPage(targetDir);
        }
        catch {
        }
        try {
            const entries = await fs.promises.readdir(releasesDir, {
                withFileTypes: true,
            });
            const dirs = entries
                .filter((e) => e.isDirectory())
                .map((e) => e.name)
                .filter((n) => n.startsWith('backup.'))
                .sort()
                .reverse();
            const keep = new Set(dirs.slice(0, 3));
            for (const d of dirs) {
                if (keep.has(d))
                    continue;
                fs.promises
                    .rm(path.join(releasesDir, d), { recursive: true, force: true })
                    .catch(() => {
                });
            }
        }
        catch {
        }
        fs.promises.rm(baseTmp, { recursive: true, force: true }).catch(() => {
        });
    }
    async ensureLegacyAliases(targetDir) {
        try {
            const legacyPath = path.join(targetDir, this.legacyApplicationName);
            await fs.promises.rm(legacyPath, { force: true }).catch(() => {
            });
            const entries = await fs.promises.readdir(targetDir, {
                withFileTypes: true,
            });
            const application = entries
                .filter((e) => e.isFile())
                .map((e) => e.name)
                .find((name) => name.toLowerCase().endsWith('.application'));
            if (!application) {
                return;
            }
            await fs.promises.copyFile(path.join(targetDir, application), legacyPath);
        }
        catch {
        }
    }
};
exports.ClientUpdatesService = ClientUpdatesService;
exports.ClientUpdatesService = ClientUpdatesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], ClientUpdatesService);
//# sourceMappingURL=client-updates.service.js.map