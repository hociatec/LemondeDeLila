"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ClientUpdatesService", {
    enumerable: true,
    get: function() {
        return ClientUpdatesService;
    }
});
const _fs = /*#__PURE__*/ _interop_require_wildcard(require("fs"));
const _os = /*#__PURE__*/ _interop_require_wildcard(require("os"));
const _path = /*#__PURE__*/ _interop_require_wildcard(require("path"));
const _child_process = require("child_process");
const _util = require("util");
const _common = require("@nestjs/common");
const _versionutils = require("../../common/utils/version.utils");
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
const execFileAsync = (0, _util.promisify)(_child_process.execFile);
let ClientUpdatesService = class ClientUpdatesService {
    hasDirectoryEntries(dir) {
        try {
            return _fs.readdirSync(dir).length > 0;
        } catch  {
            return false;
        }
    }
    bootstrapPersistentStorage(legacyDataDir, persistentDataDir) {
        if (_path.resolve(legacyDataDir) === _path.resolve(persistentDataDir)) {
            return;
        }
        try {
            const legacyClientDir = _path.join(legacyDataDir, 'client-win');
            const persistentClientDir = _path.join(persistentDataDir, 'client-win');
            const legacyMeta = _path.join(legacyDataDir, 'latest.json');
            const persistentMeta = _path.join(persistentDataDir, 'latest.json');
            if (!this.hasDirectoryEntries(persistentClientDir) && this.hasDirectoryEntries(legacyClientDir)) {
                _fs.mkdirSync(_path.dirname(persistentClientDir), {
                    recursive: true
                });
                _fs.cpSync(legacyClientDir, persistentClientDir, {
                    recursive: true,
                    force: false,
                    errorOnExist: false
                });
            }
            if (!_fs.existsSync(persistentMeta) && _fs.existsSync(legacyMeta)) {
                _fs.mkdirSync(_path.dirname(persistentMeta), {
                    recursive: true
                });
                _fs.copyFileSync(legacyMeta, persistentMeta);
            }
        } catch  {
        // Best-effort: if migration fails we keep running with empty persistent dirs
        // and an explicit publish can repopulate artifacts.
        }
    }
    getTargetDir() {
        return this.updatesDir;
    }
    getPublicUrl() {
        return process.env.CLIENT_UPDATES_PUBLIC_URL || null;
    }
    /**
   * Resolves the public "update URL" shown to clients.
   * - If latest.json has an explicit `publicUrl`, it wins (can be .zip/.application/exe/page).
   * - Otherwise, we return `CLIENT_UPDATES_PUBLIC_URL` as-is.
   */ resolveClientPublicUrl(latest) {
        const explicit = (latest?.publicUrl || '').trim();
        if (explicit) {
            return explicit;
        }
        const base = (this.getPublicUrl() || '').trim();
        if (!base) return null;
        return base;
    }
    resolveClientPublicUrlForOrigin(latest, origin) {
        const resolved = this.resolveClientPublicUrl(latest);
        if (resolved) {
            if (resolved.startsWith('http://') || resolved.startsWith('https://') || resolved.startsWith('ms-appx://')) {
                return resolved;
            }
            if (origin && resolved.startsWith('/')) {
                return `${origin.replace(/\/$/, '')}${resolved}`;
            }
            return resolved;
        }
        if (!origin) return null;
        const base = origin.replace(/\/$/, '');
        return `${base}/updates/client-win/`;
    }
    // Reads the currently served ClickOnce manifest version from disk (source of truth for what clients download).
    async getPublishedClickOnceVersionFromDisk() {
        // Source of truth: the ClickOnce manifest currently served from updatesDir.
        // This avoids mismatches when latest.json gets out of sync.
        const targetDir = this.getTargetDir();
        const candidates = [
            _path.join(targetDir, 'LeMondeDeLila.application'),
            _path.join(targetDir, this.legacyApplicationName)
        ];
        for (const file of candidates){
            try {
                if (!_fs.existsSync(file)) continue;
                const raw = await _fs.promises.readFile(file, 'utf-8');
                const text = raw.replace(/^\uFEFF/, '');
                const m = text.match(/assemblyIdentity[^>]*version="(?<v>[0-9.]+)"/i);
                const v = (m?.groups?.v || '').trim();
                if (!v) continue;
                // Validate format for our comparator.
                if ((0, _versionutils.parseVersion)(v) == null) continue;
                return v;
            } catch  {
            // ignore
            }
        }
        return null;
    }
    async writeLandingPage(targetDir) {
        const zipExists = _fs.existsSync(_path.join(targetDir, this.latestZipName));
        const entries = await _fs.promises.readdir(targetDir, {
            withFileTypes: true
        });
        const application = entries.filter((e)=>e.isFile()).map((e)=>e.name).find((name)=>name.toLowerCase().endsWith('.application'));
        const links = [];
        if (zipExists) {
            links.push({
                href: this.latestZipName,
                label: 'Télécharger (ZIP)',
                note: 'Version portable (à extraire).'
            });
        }
        if (application) {
            links.push({
                href: application,
                label: 'Installer / Mettre à jour (ClickOnce)',
                note: 'Si vous utilisez ClickOnce.'
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
      ${links.length > 0 ? links.map((l, idx)=>`<div style="margin-top: ${idx === 0 ? 0 : 12}px;">
                     <a class="btn ${idx === 0 ? '' : 'secondary'}" href="${l.href}">${l.label}</a>
                     ${l.note ? `<div class="note">${l.note}</div>` : ''}
                   </div>`).join('\n') : '<div>Aucun package disponible pour le moment.</div>'}
      <div class="note" style="margin-top: 16px;">
        Si l’application vous indique qu’une mise à jour est requise, installez la dernière version puis relancez.
      </div>
    </div>
  </body>
</html>`;
        await _fs.promises.writeFile(_path.join(targetDir, 'index.html'), html, 'utf-8');
    }
    async getLatest() {
        try {
            const stats = await _fs.promises.stat(this.metaPath);
            const mtimeMs = stats.mtimeMs;
            if (this.latestMeta && this.latestMetaMtimeMs != null && this.latestMetaMtimeMs === mtimeMs) {
                return this.latestMeta;
            }
            const raw = await _fs.promises.readFile(this.metaPath, 'utf-8');
            const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
            this.latestMeta = parsed;
            this.latestMetaMtimeMs = mtimeMs;
            return parsed;
        } catch (error) {
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
        const dir = _path.dirname(this.metaPath);
        await _fs.promises.mkdir(dir, {
            recursive: true
        });
        await _fs.promises.writeFile(this.metaPath, JSON.stringify(meta, null, 2));
        this.latestMeta = meta;
        try {
            const stats = await _fs.promises.stat(this.metaPath);
            this.latestMetaMtimeMs = stats.mtimeMs;
        } catch  {
            this.latestMetaMtimeMs = Date.now();
        }
    }
    /**
   * Returns the minimum required client version, coming from:
   * - env `CLIENT_MIN_VERSION` (emergency override)
   * - latest.json `minRequiredVersion`
   * - env `CLIENT_FORCE_LATEST=1` => ClickOnce manifest version (fallback to latest.json `version`)
   */ async getMinRequiredVersion() {
        const env = (process.env.CLIENT_MIN_VERSION || '').trim();
        const latest = await this.getLatest();
        const forceLatestRaw = (process.env.CLIENT_FORCE_LATEST || '').trim().toLowerCase();
        const forceLatest = forceLatestRaw === '1' || forceLatestRaw === 'true' || forceLatestRaw === 'yes' || forceLatestRaw === 'y';
        const metaMin = (latest?.minRequiredVersion || '').trim();
        const publishedClickOnce = await this.getPublishedClickOnceVersionFromDisk();
        const hasClickOnce = Boolean(publishedClickOnce && (0, _versionutils.parseVersion)(publishedClickOnce) != null);
        // "Force latest" must never lock clients out if ClickOnce artifacts are missing.
        // If ClickOnce isn't published/served, forcing a min version is pointless (clients can't update).
        const latestAsMin = forceLatest && hasClickOnce ? (publishedClickOnce || '').trim() : '';
        const candidates = [
            env,
            metaMin,
            latestAsMin
        ].filter((v)=>Boolean(v));
        if (candidates.length === 0) return null;
        if (candidates.length === 1) return candidates[0] || null;
        // Choose the highest valid one (invalids are ignored, except env which still wins as a fallback).
        const parsed = candidates.map((v)=>({
                v,
                p: (0, _versionutils.parseVersion)(v)
            })).filter((x)=>x.p != null);
        if (parsed.length === 0) {
            return env || metaMin || latestAsMin || null;
        }
        parsed.sort((a, b)=>b.p - a.p);
        // Safety: never return a minRequiredVersion higher than what we can actually serve via ClickOnce.
        // This prevents a common outage where deployments overwrite the ClickOnce folder, leaving clients unable to update.
        if (hasClickOnce) {
            const clickOncePacked = (0, _versionutils.parseVersion)(publishedClickOnce);
            if (clickOncePacked != null && parsed[0].p > clickOncePacked) {
                return publishedClickOnce;
            }
            return parsed[0].v;
        }
        // No ClickOnce on disk: only allow an explicit env override. Ignore metaMin/forceLatest to avoid lockout.
        return env || null;
    }
    async assertZipSafe(zipPath) {
        await this.assertUnzipAvailable();
        const { stdout } = await execFileAsync('unzip', [
            '-Z1',
            zipPath
        ], {
            timeout: 60_000,
            maxBuffer: 50 * 1024 * 1024
        });
        const entries = stdout.split(/\r?\n/).map((l)=>l.trim()).filter(Boolean);
        for (const entry of entries){
            if (entry.startsWith('/') || entry.startsWith('\\') || entry.includes('..') || entry.includes(':') || entry.includes('\\')) {
                throw new Error(`Archive invalide (entrée non sûre): ${entry}`);
            }
        }
    }
    async assertUnzipAvailable() {
        try {
            await execFileAsync('unzip', [
                '-v'
            ], {
                timeout: 10_000
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : '';
            if (msg.includes('ENOENT')) {
                throw new Error('Dépendance manquante: commande "unzip" introuvable (installez le paquet unzip).');
            }
            throw err;
        }
    }
    async replaceDirectoryContents(srcDir, dstDir) {
        // Best-effort publish method that works even if symlinks are not supported/allowed.
        await _fs.promises.mkdir(dstDir, {
            recursive: true
        });
        const existing = await _fs.promises.readdir(dstDir, {
            withFileTypes: true
        });
        for (const e of existing){
            await _fs.promises.rm(_path.join(dstDir, e.name), {
                recursive: true,
                force: true
            });
        }
        // Avoid fs.promises.cp: not available on older Node versions (common on some servers).
        const copyRecursive = async (from, to)=>{
            const st = await _fs.promises.stat(from);
            if (st.isDirectory()) {
                await _fs.promises.mkdir(to, {
                    recursive: true
                });
                const entries = await _fs.promises.readdir(from, {
                    withFileTypes: true
                });
                for (const e of entries){
                    await copyRecursive(_path.join(from, e.name), _path.join(to, e.name));
                }
                return;
            }
            // File (or other): treat as file.
            await _fs.promises.mkdir(_path.dirname(to), {
                recursive: true
            });
            await _fs.promises.copyFile(from, to);
        };
        await copyRecursive(srcDir, dstDir);
    }
    async applyZip(zipPath) {
        await this.assertZipSafe(zipPath);
        const baseTmp = await _fs.promises.mkdtemp(_path.join(_os.tmpdir(), 'lila-client-update-'));
        const stagingDir = _path.join(baseTmp, 'staging');
        await _fs.promises.mkdir(stagingDir, {
            recursive: true
        });
        // Extract to staging
        await execFileAsync('unzip', [
            '-o',
            zipPath,
            '-d',
            stagingDir
        ], {
            timeout: 10 * 60_000,
            maxBuffer: 50 * 1024 * 1024
        });
        const stagingEntries = await _fs.promises.readdir(stagingDir, {
            withFileTypes: true
        });
        const extractedApplication = stagingEntries.filter((e)=>e.isFile()).map((e)=>e.name).find((name)=>name.toLowerCase().endsWith('.application'));
        if (!extractedApplication) {
            throw new Error('Archive invalide : manifeste ClickOnce (.application) manquant.');
        }
        const applicationFilesDir = stagingEntries.filter((e)=>e.isDirectory()).map((e)=>e.name).find((name)=>name === 'Application Files');
        if (!applicationFilesDir) {
            throw new Error('Archive invalide : dossier "Application Files" introuvable.');
        }
        const targetDir = this.getTargetDir();
        const parent = _path.dirname(targetDir);
        let releasesDir = _path.join(parent, 'client-win.releases');
        let canUseDirectorySwap = true;
        try {
            await _fs.promises.mkdir(releasesDir, {
                recursive: true
            });
        } catch (err) {
            canUseDirectorySwap = false;
            const message = err?.message || 'erreur inconnue';
            this.logger.warn(`Impossible de préparer le dossier de backups (${releasesDir}). ` + `Fallback publication sans swap de répertoire: ${message}`);
            releasesDir = null;
        }
        // Publish strategy:
        // - Primary: swap directories (fast, avoids duplicating storage).
        // - Fallback: replace directory contents (works even when renames/symlinks are constrained).
        let published = false;
        const resolveExistingTarget = async ()=>{
            try {
                const existing = await _fs.promises.lstat(targetDir);
                if (existing.isDirectory()) {
                    return targetDir;
                }
                if (existing.isSymbolicLink()) {
                    let resolved = null;
                    try {
                        const realPath = await _fs.promises.realpath(targetDir);
                        const realStats = await _fs.promises.lstat(realPath);
                        if (realStats.isDirectory()) {
                            resolved = realPath;
                        }
                    } catch  {
                    // ignore
                    }
                    await _fs.promises.unlink(targetDir).catch(()=>{
                    /* ignore */ });
                    return resolved;
                }
            } catch  {
            // targetDir might not exist yet
            }
            return null;
        };
        if (canUseDirectorySwap && releasesDir) {
            const backupDir = _path.join(releasesDir, `backup.${Date.now()}`);
            try {
                const existingTargetPath = await resolveExistingTarget();
                if (existingTargetPath) {
                    await _fs.promises.rename(existingTargetPath, backupDir);
                    await _fs.promises.rename(stagingDir, targetDir);
                    published = true;
                }
            } catch  {
            // fallback below
            }
        }
        if (!published) {
            await this.replaceDirectoryContents(stagingDir, targetDir);
            published = true;
        }
        await this.ensureLegacyAliases(targetDir);
        // Keep a stable downloadable artifact for clients (no need to keep the original upload name).
        try {
            const zipDest = _path.join(targetDir, this.latestZipName);
            await _fs.promises.copyFile(zipPath, zipDest);
        } catch  {
        // Best-effort
        }
        // Provide a landing page even without nginx directory listing.
        try {
            await this.writeLandingPage(targetDir);
        } catch  {
        // Best-effort
        }
        // Best-effort cleanup: keep last 3 backups.
        if (releasesDir) {
            try {
                const entries = await _fs.promises.readdir(releasesDir, {
                    withFileTypes: true
                });
                const dirs = entries.filter((e)=>e.isDirectory()).map((e)=>e.name).filter((n)=>n.startsWith('backup.')).sort().reverse();
                const keep = new Set(dirs.slice(0, 3));
                for (const d of dirs){
                    if (keep.has(d)) continue;
                    _fs.promises.rm(_path.join(releasesDir, d), {
                        recursive: true,
                        force: true
                    }).catch(()=>{
                    /* ignore */ });
                }
            } catch  {
            // ignore
            }
        }
        _fs.promises.rm(baseTmp, {
            recursive: true,
            force: true
        }).catch(()=>{
        /* ignore */ });
    }
    async ensureLegacyAliases(targetDir) {
        try {
            const legacyPath = _path.join(targetDir, this.legacyApplicationName);
            await _fs.promises.rm(legacyPath, {
                force: true
            }).catch(()=>{
            /* ignore */ });
            const entries = await _fs.promises.readdir(targetDir, {
                withFileTypes: true
            });
            const application = entries.filter((e)=>e.isFile()).map((e)=>e.name).find((name)=>name.toLowerCase().endsWith('.application'));
            if (!application) {
                return;
            }
            await _fs.promises.copyFile(_path.join(targetDir, application), legacyPath);
        } catch  {
        // Best-effort: if it fails, updates are still accessible via the real *.application filename.
        }
    }
    constructor(){
        this.logger = new _common.Logger(ClientUpdatesService.name);
        this.legacyApplicationName = 'client-win.application';
        this.latestZipName = 'client-win.zip';
        this.latestMeta = undefined;
        this.latestMetaMtimeMs = null;
        const backendRoot = _path.resolve(__dirname, '..', '..', '..');
        const legacyDataDir = _path.join(backendRoot, 'data', 'client-updates');
        const nodeEnv = (process.env.NODE_ENV || '').trim().toLowerCase();
        const defaultDataDir = nodeEnv === 'production' ? _path.join(_os.homedir(), '.local', 'share', 'lemonde-de-lila', 'client-updates') : legacyDataDir;
        const defaultUpdatesDir = _path.join(defaultDataDir, 'client-win');
        if (nodeEnv === 'production' && !process.env.CLIENT_UPDATES_DIR && !process.env.CLIENT_UPDATES_META_PATH) {
            this.bootstrapPersistentStorage(legacyDataDir, defaultDataDir);
        }
        // Folder served by your reverse-proxy (nginx) as:
        //   https://api.lilas.hociatec.fr/updates/client-win/
        // Configure this path on the Linux server via CLIENT_UPDATES_DIR.
        this.updatesDir = process.env.CLIENT_UPDATES_DIR || defaultUpdatesDir;
        // Metadata lives in a stable location (independent of process.cwd()).
        // Can be overridden for advanced deployments.
        this.metaPath = process.env.CLIENT_UPDATES_META_PATH || _path.join(defaultDataDir, 'latest.json');
    }
};
ClientUpdatesService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [])
], ClientUpdatesService);
