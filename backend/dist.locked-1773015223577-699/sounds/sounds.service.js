"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "SoundsService", {
    enumerable: true,
    get: function() {
        return SoundsService;
    }
});
const _common = require("@nestjs/common");
const _child_process = require("child_process");
const _crypto = /*#__PURE__*/ _interop_require_wildcard(require("crypto"));
const _fs = /*#__PURE__*/ _interop_require_wildcard(require("fs"));
const _os = require("os");
const _path = /*#__PURE__*/ _interop_require_wildcard(require("path"));
const _ffmpegstatic = /*#__PURE__*/ _interop_require_default(require("ffmpeg-static"));
const _ffprobestatic = /*#__PURE__*/ _interop_require_default(require("ffprobe-static"));
const _soundstypes = require("./sounds.types");
const _notificationservice = require("../notification/services/notification.service");
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
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
let SoundsService = class SoundsService {
    hasDirectoryEntries(dir) {
        try {
            return _fs.readdirSync(dir).length > 0;
        } catch  {
            return false;
        }
    }
    bootstrapPersistentStorage(legacyRoot, persistentRoot) {
        if (_path.resolve(legacyRoot) === _path.resolve(persistentRoot)) {
            return;
        }
        try {
            if (this.hasDirectoryEntries(legacyRoot) && !this.hasDirectoryEntries(persistentRoot)) {
                _fs.mkdirSync(_path.dirname(persistentRoot), {
                    recursive: true
                });
                _fs.cpSync(legacyRoot, persistentRoot, {
                    recursive: true,
                    force: false,
                    errorOnExist: false
                });
            }
        } catch  {
        // best-effort bootstrap
        }
    }
    resolveDataRoot() {
        const override = String(process.env.LMDL_SOUNDS_DIR ?? '').trim();
        if (override) return _path.resolve(override);
        const legacyRoot = _path.resolve(__dirname, '..', '..', 'data', 'sounds');
        const nodeEnv = String(process.env.NODE_ENV ?? '').trim().toLowerCase();
        if (nodeEnv !== 'production') {
            return legacyRoot;
        }
        const persistentRoot = process.platform === 'win32' ? _path.join(String(process.env.PROGRAMDATA ?? _path.join((0, _os.homedir)(), 'AppData', 'Local')), 'lemonde-de-lila', 'sounds') : _path.join((0, _os.homedir)(), '.local', 'share', 'lemonde-de-lila', 'sounds');
        this.bootstrapPersistentStorage(legacyRoot, persistentRoot);
        try {
            _fs.mkdirSync(persistentRoot, {
                recursive: true
            });
            const testFile = _path.join(persistentRoot, `.write-test-${process.pid}-${Date.now()}`);
            _fs.writeFileSync(testFile, 'ok', 'utf-8');
            _fs.rmSync(testFile, {
                force: true
            });
            return persistentRoot;
        } catch (err) {
            this.logger.warn(`Persistent sounds dir not writable (${persistentRoot}); falling back to legacy (${legacyRoot}): ${String(err?.message ?? err)}`);
            return legacyRoot;
        }
    }
    dataRoot() {
        return this.storageRoot;
    }
    storageIoError(action, err) {
        const anyErr = err;
        const code = anyErr?.code ? ` (${String(anyErr.code)})` : '';
        const details = anyErr?.message ? `: ${String(anyErr.message)}` : '';
        const stack = typeof anyErr?.stack === 'string' ? anyErr.stack : undefined;
        this.logger.error(`Sound storage error during ${action}${code}${details}`, stack);
        return new _common.InternalServerErrorException(`Erreur stockage sons pendant ${action}${code}${details}. Vérifiez les permissions du dossier de données.`.trim());
    }
    getFfmpegPath() {
        const candidate = _ffmpegstatic.default || '';
        if (!candidate) {
            throw new _common.InternalServerErrorException('ffmpeg indisponible (validation audio requise).');
        }
        return candidate;
    }
    getFfprobePath() {
        const raw = _ffprobestatic.default;
        const candidate = raw?.path || raw;
        if (!candidate) {
            throw new _common.InternalServerErrorException('ffprobe indisponible (validation audio requise).');
        }
        return candidate;
    }
    async runProcess(command, args, timeoutMs = 15000) {
        return new Promise((resolve, reject)=>{
            const child = (0, _child_process.spawn)(command, args, {
                windowsHide: true
            });
            const stdout = [];
            const stderr = [];
            let finished = false;
            const timer = setTimeout(()=>{
                if (finished) return;
                finished = true;
                try {
                    child.kill('SIGKILL');
                } catch  {
                // ignore
                }
                reject(new Error(`Process timeout after ${timeoutMs}ms: ${command}`));
            }, timeoutMs);
            child.stdout?.on('data', (d)=>stdout.push(d));
            child.stderr?.on('data', (d)=>stderr.push(d));
            child.on('error', (err)=>{
                if (finished) return;
                finished = true;
                clearTimeout(timer);
                reject(err);
            });
            child.on('close', (code)=>{
                if (finished) return;
                finished = true;
                clearTimeout(timer);
                resolve({
                    code: typeof code === 'number' ? code : -1,
                    stdout: Buffer.concat(stdout).toString('utf8'),
                    stderr: Buffer.concat(stderr).toString('utf8')
                });
            });
        });
    }
    isSpawnExecutionError(err) {
        const anyErr = err;
        const code = String(anyErr?.code ?? '').toUpperCase();
        return code === 'ENOENT' || code === 'EACCES' || code === 'EPERM';
    }
    audioToolExecutionError(tool, err, hint) {
        const anyErr = err;
        const code = anyErr?.code ? ` (${String(anyErr.code)})` : '';
        const details = anyErr?.message ? `: ${String(anyErr.message)}` : '';
        const extra = hint ? ` ${hint}` : '';
        return new _common.InternalServerErrorException(`Impossible d'exécuter ${tool}${code}${details}.${extra}`.trim());
    }
    async readWavMeta(filePath) {
        const fh = await _fs.promises.open(filePath, 'r');
        try {
            const headerSize = 256 * 1024;
            const buf = Buffer.allocUnsafe(headerSize);
            const { bytesRead } = await fh.read(buf, 0, headerSize, 0);
            const b = buf.subarray(0, bytesRead);
            if (b.length < 44) {
                throw new _common.BadRequestException('Fichier WAV invalide (entête).');
            }
            if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') {
                throw new _common.BadRequestException('Fichier WAV invalide (RIFF/WAVE).');
            }
            let pos = 12;
            let audioFormat = 0;
            let bitsPerSample = 0;
            let byteRate = 0;
            let dataOffset = -1;
            let dataSize = 0;
            while(pos + 8 <= b.length){
                const chunkId = b.toString('ascii', pos, pos + 4);
                const chunkSize = b.readUInt32LE(pos + 4);
                pos += 8;
                if (chunkId === 'fmt ') {
                    if (pos + 16 > b.length) {
                        throw new _common.BadRequestException('Fichier WAV invalide (fmt).');
                    }
                    audioFormat = b.readUInt16LE(pos + 0);
                    const numChannels = b.readUInt16LE(pos + 2);
                    const sampleRate = b.readUInt32LE(pos + 4);
                    byteRate = b.readUInt32LE(pos + 8);
                    bitsPerSample = b.readUInt16LE(pos + 14);
                    if (!numChannels || !sampleRate || !byteRate || !bitsPerSample) {
                        throw new _common.BadRequestException('Fichier WAV invalide (fmt).');
                    }
                    if (audioFormat !== 1 && audioFormat !== 3) {
                        throw new _common.BadRequestException('Format WAV non supporté (seulement PCM/Float).');
                    }
                } else if (chunkId === 'data') {
                    dataOffset = pos;
                    dataSize = chunkSize;
                }
                // Chunk sizes are padded to word boundary.
                pos += chunkSize + chunkSize % 2;
                if (audioFormat && dataOffset >= 0) break;
            }
            if (!audioFormat || dataOffset < 0 || dataSize <= 0 || !byteRate) {
                throw new _common.BadRequestException('Fichier WAV invalide (données).');
            }
            const durationSeconds = dataSize / byteRate;
            if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
                throw new _common.BadRequestException('Fichier WAV invalide (durée nulle).');
            }
            return {
                durationSeconds,
                dataOffset,
                dataSize,
                bitsPerSample,
                audioFormat,
                byteRate
            };
        } finally{
            await fh.close().catch(()=>undefined);
        }
    }
    async isWavSilent(filePath) {
        const meta = await this.readWavMeta(filePath);
        const silenceByte = meta.bitsPerSample === 8 && meta.audioFormat === 1 ? 0x80 : 0x00;
        const segmentSize = Math.min(64 * 1024, meta.dataSize);
        const offsets = [
            meta.dataOffset,
            meta.dataOffset + Math.max(0, Math.floor(meta.dataSize / 2) - Math.floor(segmentSize / 2)),
            meta.dataOffset + Math.max(0, meta.dataSize - segmentSize)
        ];
        const fh = await _fs.promises.open(filePath, 'r');
        try {
            const buf = Buffer.allocUnsafe(segmentSize);
            for (const off of offsets){
                const { bytesRead } = await fh.read(buf, 0, segmentSize, off);
                if (bytesRead <= 0) {
                    throw new _common.BadRequestException('Fichier WAV invalide (lecture).');
                }
                const slice = buf.subarray(0, bytesRead);
                for(let i = 0; i < slice.length; i++){
                    if (slice[i] !== silenceByte) {
                        return false;
                    }
                }
            }
            return true;
        } finally{
            await fh.close().catch(()=>undefined);
        }
    }
    async probeDurationSeconds(filePath) {
        const ext = _path.extname(filePath).toLowerCase();
        let ffprobePath;
        try {
            ffprobePath = this.getFfprobePath();
        } catch (err) {
            if (ext === '.wav' || ext === '.wave') {
                return (await this.readWavMeta(filePath)).durationSeconds;
            }
            throw err;
        }
        let res;
        try {
            res = await this.runProcess(ffprobePath, [
                '-v',
                'error',
                '-show_entries',
                'format=duration',
                '-of',
                'default=nw=1:nk=1',
                filePath
            ], 10000);
        } catch (err) {
            if (this.isSpawnExecutionError(err) && (ext === '.wav' || ext === '.wave')) {
                return (await this.readWavMeta(filePath)).durationSeconds;
            }
            throw this.audioToolExecutionError('ffprobe', err, 'Utilisez un fichier .wav si ffprobe est bloqué sur ce serveur.');
        }
        if (res.code !== 0) {
            this.logger.warn(`ffprobe failed: ${res.stderr || res.stdout}`);
            throw new _common.BadRequestException('Fichier audio invalide (durée illisible).');
        }
        const duration = Number.parseFloat(String(res.stdout).trim());
        if (!Number.isFinite(duration) || duration <= 0) {
            throw new _common.BadRequestException('Fichier audio invalide (durée nulle).');
        }
        return duration;
    }
    async detectSilence(filePath) {
        const ext = _path.extname(filePath).toLowerCase();
        let ffmpegPath;
        try {
            ffmpegPath = this.getFfmpegPath();
        } catch (err) {
            if (ext === '.wav' || ext === '.wave') {
                return await this.isWavSilent(filePath);
            }
            throw err;
        }
        let res;
        try {
            res = await this.runProcess(ffmpegPath, [
                '-hide_banner',
                '-i',
                filePath,
                '-af',
                'volumedetect',
                '-f',
                'null',
                '-'
            ], 20000);
        } catch (err) {
            if (this.isSpawnExecutionError(err) && (ext === '.wav' || ext === '.wave')) {
                return await this.isWavSilent(filePath);
            }
            throw this.audioToolExecutionError('ffmpeg', err, 'Utilisez un fichier .wav si ffmpeg est bloqué sur ce serveur.');
        }
        const output = `${res.stderr}\n${res.stdout}`;
        const match = output.match(/max_volume:\s*([-\\w.]+)\s*dB/i);
        if (!match) {
            return false;
        }
        return String(match[1]).toLowerCase() === '-inf';
    }
    async transcodeToStableWav(inputPath) {
        const ffmpegPath = this.getFfmpegPath();
        const tempDir = await _fs.promises.mkdtemp(_path.join((0, _os.tmpdir)(), 'lmdl-sound-'));
        const outputPath = _path.join(tempDir, 'sound.wav');
        const res = await this.runProcess(ffmpegPath, [
            '-y',
            '-hide_banner',
            '-loglevel',
            'error',
            '-i',
            inputPath,
            '-vn',
            '-ac',
            '2',
            '-ar',
            '44100',
            '-codec:a',
            'pcm_s16le',
            '-map_metadata',
            '-1',
            outputPath
        ], 30000);
        if (res.code !== 0) {
            this.logger.warn(`ffmpeg transcode failed: ${res.stderr || res.stdout}`);
            throw new _common.BadRequestException('Fichier audio invalide (transcodage).');
        }
        return {
            outputPath,
            tempDir
        };
    }
    async removeUnusedFilesForSoundId(soundId, keepSha256) {
        const soundDir = _path.join(this.dataRoot(), soundId);
        let deleted = 0;
        try {
            const files = await _fs.promises.readdir(soundDir);
            for (const file of files){
                const lower = file.toLowerCase();
                if (!(lower.endsWith('.wav') || lower.endsWith('.mp3'))) continue;
                if (file === `${keepSha256}.wav`) continue;
                try {
                    await _fs.promises.rm(_path.join(soundDir, file), {
                        force: true
                    });
                    deleted++;
                } catch  {
                // ignore
                }
            }
        } catch  {
        // ignore
        }
        return deleted;
    }
    manifestPath() {
        return _path.join(this.dataRoot(), 'manifest.json');
    }
    tableAmbiencesPath() {
        return _path.join(this.dataRoot(), 'table-ambiences.json');
    }
    normalizeSoundKey(input) {
        const raw = (input || '').trim();
        const found = _soundstypes.SOUND_KEYS.find((k)=>k.toLowerCase() === raw.toLowerCase());
        if (!found) {
            throw new _common.BadRequestException(`soundId invalide: ${raw}`);
        }
        return found;
    }
    normalizeTableAmbienceKey(input) {
        const soundId = this.normalizeSoundKey(input);
        if (!/^TableAmbience\d+$/i.test(soundId)) {
            throw new _common.BadRequestException(`Ambiance de table invalide: ${soundId}`);
        }
        return soundId;
    }
    async readManifest() {
        const file = this.manifestPath();
        try {
            const raw = await _fs.promises.readFile(file, 'utf-8');
            const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
            if (!parsed?.sounds || typeof parsed?.sounds !== 'object') {
                throw new Error('manifest invalide');
            }
            return parsed;
        } catch  {
            return {
                updatedAt: new Date().toISOString(),
                sounds: {}
            };
        }
    }
    async writeManifest(next) {
        const root = this.dataRoot();
        try {
            await _fs.promises.mkdir(root, {
                recursive: true
            });
            await _fs.promises.writeFile(this.manifestPath(), JSON.stringify(next, null, 2), 'utf-8');
        } catch (err) {
            throw this.storageIoError('écriture manifest.json', err);
        }
    }
    async readTableAmbiences() {
        const file = this.tableAmbiencesPath();
        try {
            const raw = await _fs.promises.readFile(file, 'utf-8');
            const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
            const itemsRaw = Array.isArray(parsed?.items) ? parsed.items : [];
            const items = itemsRaw.map((it)=>({
                    soundId: this.normalizeTableAmbienceKey(String(it?.soundId ?? '')),
                    name: String(it?.name ?? '').trim(),
                    enabled: typeof it?.enabled === 'boolean' ? it.enabled : true
                })).filter((it)=>it.soundId && it.name);
            const seen = new Set();
            const deduped = [];
            for (const it of items){
                const k = it.soundId.toLowerCase();
                if (seen.has(k)) continue;
                seen.add(k);
                deduped.push(it);
            }
            return {
                updatedAt: typeof parsed?.updatedAt === 'string' && parsed.updatedAt.trim() ? parsed.updatedAt : new Date().toISOString(),
                items: deduped
            };
        } catch  {
            return {
                updatedAt: new Date().toISOString(),
                items: []
            };
        }
    }
    async writeTableAmbiences(next) {
        const root = this.dataRoot();
        try {
            await _fs.promises.mkdir(root, {
                recursive: true
            });
            await _fs.promises.writeFile(this.tableAmbiencesPath(), JSON.stringify(next, null, 2), 'utf-8');
        } catch (err) {
            throw this.storageIoError('écriture table-ambiences.json', err);
        }
    }
    async listTableAmbiences() {
        return this.listTableAmbiencesWithFilter();
    }
    async listTableAmbiencesWithFilter(options) {
        const current = await this.readTableAmbiences();
        if (options?.includeDisabled === true) {
            return current;
        }
        return {
            ...current,
            items: current.items.filter((it)=>it.enabled !== false)
        };
    }
    async createTableAmbience(nameRaw) {
        const name = String(nameRaw ?? '').trim();
        if (!name) {
            throw new _common.BadRequestException("Nom d'ambiance requis.");
        }
        const current = await this.readTableAmbiences();
        const used = new Set(current.items.map((i)=>i.soundId.toLowerCase()));
        const available = _soundstypes.SOUND_KEYS.filter((k)=>/^TableAmbience\d+$/.test(k)).find((k)=>!used.has(k.toLowerCase()));
        if (!available) {
            throw new _common.BadRequestException('Nombre maximum atteint (20 ambiances de table).');
        }
        const created = {
            soundId: available,
            name,
            enabled: true
        };
        const next = {
            updatedAt: new Date().toISOString(),
            items: [
                ...current.items,
                created
            ]
        };
        await this.writeTableAmbiences(next);
        await this.notifications.notifyAll('sounds.tableAmbiences.updated', {
            updatedAt: next.updatedAt
        });
        return created;
    }
    async renameTableAmbience(soundIdRaw, nameRaw) {
        const soundId = this.normalizeTableAmbienceKey(soundIdRaw);
        const name = String(nameRaw ?? '').trim();
        if (!name) {
            throw new _common.BadRequestException("Nom d'ambiance requis.");
        }
        const current = await this.readTableAmbiences();
        const idx = current.items.findIndex((i)=>i.soundId.toLowerCase() === soundId.toLowerCase());
        if (idx < 0) {
            throw new _common.NotFoundException('Ambiance de table introuvable.');
        }
        const nextItems = [
            ...current.items
        ];
        nextItems[idx] = {
            soundId: soundId,
            name,
            enabled: nextItems[idx]?.enabled !== false
        };
        const next = {
            updatedAt: new Date().toISOString(),
            items: nextItems
        };
        await this.writeTableAmbiences(next);
        await this.notifications.notifyAll('sounds.tableAmbiences.updated', {
            updatedAt: next.updatedAt
        });
        return nextItems[idx];
    }
    async deleteTableAmbience(soundIdRaw) {
        const soundId = this.normalizeTableAmbienceKey(soundIdRaw);
        const current = await this.readTableAmbiences();
        const nextItems = current.items.filter((i)=>i.soundId.toLowerCase() !== soundId.toLowerCase());
        const next = {
            updatedAt: new Date().toISOString(),
            items: nextItems
        };
        await this.writeTableAmbiences(next);
        // Also clear associated sound to free the slot completely.
        await this.clearSound(soundId);
        await this.notifications.notifyAll('sounds.tableAmbiences.updated', {
            updatedAt: next.updatedAt
        });
        return {
            ok: true
        };
    }
    async setTableAmbienceEnabled(soundIdRaw, enabled) {
        const soundId = this.normalizeTableAmbienceKey(soundIdRaw);
        const current = await this.readTableAmbiences();
        const idx = current.items.findIndex((i)=>i.soundId.toLowerCase() === soundId.toLowerCase());
        if (idx < 0) {
            throw new _common.NotFoundException('Ambiance de table introuvable.');
        }
        const nextItems = [
            ...current.items
        ];
        nextItems[idx] = {
            ...nextItems[idx],
            enabled: enabled === true
        };
        const next = {
            updatedAt: new Date().toISOString(),
            items: nextItems
        };
        await this.writeTableAmbiences(next);
        await this.notifications.notifyAll('sounds.tableAmbiences.updated', {
            updatedAt: next.updatedAt
        });
        return nextItems[idx];
    }
    async getPublicManifest(origin) {
        const manifest = await this.readManifest();
        // Always filter to known keys and only publish entries that have an on-disk file.
        // This prevents the client from trying to download sounds that were removed from disk
        // but accidentally left behind in the manifest.
        const sounds = {};
        for (const key of _soundstypes.SOUND_KEYS){
            const entry = manifest.sounds?.[key];
            if (!entry) continue;
            const root = this.dataRoot();
            const soundDir = _path.join(root, entry.soundId);
            const wav = _path.join(soundDir, `${entry.sha256}.wav`);
            const mp3 = _path.join(soundDir, `${entry.sha256}.mp3`);
            if (!_fs.existsSync(wav) && !_fs.existsSync(mp3)) {
                continue;
            }
            sounds[key] = origin ? {
                ...entry,
                url: `${origin}${entry.url}`
            } : entry;
        }
        return {
            ...manifest,
            sounds
        };
    }
    async setSound(soundIdRaw, tempFilePath, originalName) {
        const soundId = this.normalizeSoundKey(soundIdRaw);
        if (!tempFilePath || !_fs.existsSync(tempFilePath)) {
            throw new _common.BadRequestException('Fichier manquant.');
        }
        const ext = _path.extname(originalName || tempFilePath).toLowerCase();
        if (ext !== '.mp3' && ext !== '.wav' && ext !== '.wave') {
            throw new _common.BadRequestException('Seuls les fichiers .mp3, .wav ou .wave sont acceptés.');
        }
        const isWavInput = ext === '.wav' || ext === '.wave';
        const stat = await _fs.promises.stat(tempFilePath);
        // Safety: keep reasonably small. Can be tuned.
        // WAV is much larger than MP3 (PCM). Keep this high; admin-only endpoint.
        const maxBytes = 250 * 1024 * 1024;
        if (stat.size <= 0 || stat.size > maxBytes) {
            throw new _common.BadRequestException(`Taille fichier invalide (max ${maxBytes} bytes).`);
        }
        // Validate input and re-encode to a stable WAV (PCM) format.
        const minDurationSeconds = 0.2;
        const inputDuration = await this.probeDurationSeconds(tempFilePath);
        if (inputDuration < minDurationSeconds) {
            throw new _common.BadRequestException('Son trop court (min 200ms).');
        }
        let bytes = Buffer.alloc(0);
        let sha256 = '';
        let encodedSize = 0;
        let tempDir = null;
        let outputPath = tempFilePath;
        try {
            try {
                const transcoded = await this.transcodeToStableWav(tempFilePath);
                outputPath = transcoded.outputPath;
                tempDir = transcoded.tempDir;
            } catch (err) {
                // Fallback: allow WAV upload even if ffmpeg is blocked/unavailable on the host.
                if (isWavInput && (this.isSpawnExecutionError(err) || err instanceof _common.InternalServerErrorException)) {
                    outputPath = tempFilePath;
                    tempDir = null;
                } else if (this.isSpawnExecutionError(err)) {
                    throw this.audioToolExecutionError('ffmpeg', err, 'Utilisez un fichier .wav si ffmpeg est bloqué sur ce serveur.');
                } else {
                    throw err;
                }
            }
            const encodedStat = await _fs.promises.stat(outputPath);
            if (encodedStat.size <= 0 || encodedStat.size > maxBytes) {
                throw new _common.BadRequestException(`Taille fichier invalide après transcodage (max ${maxBytes} bytes).`);
            }
            encodedSize = encodedStat.size;
            const duration = await this.probeDurationSeconds(outputPath);
            if (duration < minDurationSeconds) {
                throw new _common.BadRequestException('Son trop court après transcodage.');
            }
            const isSilent = await this.detectSilence(outputPath);
            if (isSilent) {
                throw new _common.BadRequestException('Son silencieux (volume max = -inf).');
            }
            bytes = await _fs.promises.readFile(outputPath);
            sha256 = _crypto.createHash('sha256').update(bytes).digest('hex');
        } finally{
            if (tempDir) {
                try {
                    await _fs.promises.rm(tempDir, {
                        recursive: true,
                        force: true
                    });
                } catch  {
                // ignore
                }
            }
        }
        const root = this.dataRoot();
        const soundDir = _path.join(root, soundId);
        try {
            await _fs.promises.mkdir(soundDir, {
                recursive: true
            });
        } catch (err) {
            throw this.storageIoError(`création dossier son (${soundId})`, err);
        }
        const destName = `${sha256}.wav`;
        const destPath = _path.join(soundDir, destName);
        try {
            await _fs.promises.writeFile(destPath, bytes);
        } catch (err) {
            throw this.storageIoError(`écriture fichier son (${soundId})`, err);
        }
        const entry = {
            soundId,
            sha256,
            bytes: encodedSize || bytes.length,
            uploadedAt: new Date().toISOString(),
            url: `/api/sounds/${encodeURIComponent(soundId)}/${sha256}.wav`
        };
        const manifest = await this.readManifest();
        const next = {
            updatedAt: new Date().toISOString(),
            sounds: {
                ...manifest.sounds || {},
                [soundId]: entry
            }
        };
        await this.writeManifest(next);
        // Nettoyage: supprimer les anciennes versions non référencées (doublons) pour ce soundId.
        await this.removeUnusedFilesForSoundId(soundId, sha256);
        await this.notifications.notifyAll('sounds.updated', {
            soundId,
            sha256,
            url: entry.url,
            updatedAt: next.updatedAt
        });
        return entry;
    }
    async clearSound(soundIdRaw) {
        const soundId = this.normalizeSoundKey(soundIdRaw);
        const manifest = await this.readManifest();
        if (!manifest.sounds?.[soundId]) {
            return {
                ok: true
            };
        }
        const next = {
            updatedAt: new Date().toISOString(),
            sounds: {
                ...manifest.sounds || {}
            }
        };
        delete next.sounds[soundId];
        await this.writeManifest(next);
        // Nettoyage best-effort: si le son est supprimé du manifest, supprimer aussi les fichiers associés.
        try {
            await _fs.promises.rm(_path.join(this.dataRoot(), soundId), {
                recursive: true,
                force: true
            });
        } catch  {
        // ignore
        }
        await this.notifications.notifyAll('sounds.updated', {
            soundId,
            sha256: null,
            url: null,
            updatedAt: next.updatedAt
        });
        return {
            ok: true
        };
    }
    async reencodeAllSounds() {
        const manifest = await this.readManifest();
        const next = {
            updatedAt: manifest.updatedAt,
            sounds: {
                ...manifest.sounds || {}
            }
        };
        const updated = [];
        const skipped = [];
        const missing = [];
        const errors = [];
        let changed = false;
        for (const soundId of _soundstypes.SOUND_KEYS){
            const entry = manifest.sounds?.[soundId];
            if (!entry?.sha256) {
                continue;
            }
            const soundDir = _path.join(this.dataRoot(), soundId);
            const srcPathWav = _path.join(soundDir, `${entry.sha256}.wav`);
            const srcPathMp3 = _path.join(soundDir, `${entry.sha256}.mp3`);
            const srcPath = _fs.existsSync(srcPathWav) ? srcPathWav : _fs.existsSync(srcPathMp3) ? srcPathMp3 : null;
            if (!srcPath) {
                missing.push(soundId);
                continue;
            }
            let tempDir = null;
            try {
                const transcoded = await this.transcodeToStableWav(srcPath);
                tempDir = transcoded.tempDir;
                const outputPath = transcoded.outputPath;
                const duration = await this.probeDurationSeconds(outputPath);
                if (duration < 0.2) {
                    throw new _common.BadRequestException('Son trop court après transcodage.');
                }
                const isSilent = await this.detectSilence(outputPath);
                if (isSilent) {
                    throw new _common.BadRequestException('Son silencieux (volume max = -inf).');
                }
                const bytes = await _fs.promises.readFile(outputPath);
                const sha256 = _crypto.createHash('sha256').update(bytes).digest('hex');
                if (sha256 === entry.sha256) {
                    skipped.push(soundId);
                    continue;
                }
                const destPath = _path.join(soundDir, `${sha256}.wav`);
                await _fs.promises.mkdir(soundDir, {
                    recursive: true
                });
                await _fs.promises.writeFile(destPath, bytes);
                next.sounds[soundId] = {
                    soundId,
                    sha256,
                    bytes: bytes.length,
                    uploadedAt: new Date().toISOString(),
                    url: `/api/sounds/${encodeURIComponent(soundId)}/${sha256}.wav`
                };
                await this.removeUnusedFilesForSoundId(soundId, sha256);
                updated.push(soundId);
                changed = true;
            } catch (err) {
                errors.push({
                    soundId,
                    message: err?.message || 'Erreur inconnue'
                });
            } finally{
                if (tempDir) {
                    try {
                        await _fs.promises.rm(tempDir, {
                            recursive: true,
                            force: true
                        });
                    } catch  {
                    // ignore
                    }
                }
            }
        }
        if (changed) {
            next.updatedAt = new Date().toISOString();
            await this.writeManifest(next);
            await this.notifications.notifyAll('sounds.updated', {
                soundId: null,
                sha256: null,
                url: null,
                updatedAt: next.updatedAt
            });
        }
        return {
            ok: true,
            updated: updated.length,
            skipped: skipped.length,
            missing: missing.length,
            errors: errors.length,
            details: {
                updated,
                skipped,
                missing,
                errors
            }
        };
    }
    async validateSoundFile(filePath) {
        const minDurationSeconds = 0.2;
        const duration = await this.probeDurationSeconds(filePath);
        if (duration < minDurationSeconds) {
            throw new _common.BadRequestException('Son trop court (min 200ms).');
        }
        const isSilent = await this.detectSilence(filePath);
        if (isSilent) {
            throw new _common.BadRequestException('Son silencieux (volume max = -inf).');
        }
    }
    async reencodeInvalidSounds() {
        const manifest = await this.readManifest();
        const next = {
            updatedAt: manifest.updatedAt,
            sounds: {
                ...manifest.sounds || {}
            }
        };
        const updated = [];
        const skipped = [];
        const missing = [];
        const invalid = [];
        const errors = [];
        let changed = false;
        for (const soundId of _soundstypes.SOUND_KEYS){
            const entry = manifest.sounds?.[soundId];
            if (!entry?.sha256) {
                continue;
            }
            const soundDir = _path.join(this.dataRoot(), soundId);
            const srcPathWav = _path.join(soundDir, `${entry.sha256}.wav`);
            const srcPathMp3 = _path.join(soundDir, `${entry.sha256}.mp3`);
            const srcPath = _fs.existsSync(srcPathWav) ? srcPathWav : _fs.existsSync(srcPathMp3) ? srcPathMp3 : null;
            if (!srcPath) {
                missing.push(soundId);
                continue;
            }
            let needsFix = false;
            try {
                await this.validateSoundFile(srcPath);
            } catch  {
                needsFix = true;
                invalid.push(soundId);
            }
            if (!needsFix) {
                skipped.push(soundId);
                continue;
            }
            let tempDir = null;
            try {
                const transcoded = await this.transcodeToStableWav(srcPath);
                tempDir = transcoded.tempDir;
                const outputPath = transcoded.outputPath;
                await this.validateSoundFile(outputPath);
                const bytes = await _fs.promises.readFile(outputPath);
                const sha256 = _crypto.createHash('sha256').update(bytes).digest('hex');
                if (sha256 === entry.sha256) {
                    skipped.push(soundId);
                    continue;
                }
                const destPath = _path.join(soundDir, `${sha256}.wav`);
                await _fs.promises.mkdir(soundDir, {
                    recursive: true
                });
                await _fs.promises.writeFile(destPath, bytes);
                next.sounds[soundId] = {
                    soundId,
                    sha256,
                    bytes: bytes.length,
                    uploadedAt: new Date().toISOString(),
                    url: `/api/sounds/${encodeURIComponent(soundId)}/${sha256}.wav`
                };
                await this.removeUnusedFilesForSoundId(soundId, sha256);
                updated.push(soundId);
                changed = true;
            } catch (err) {
                errors.push({
                    soundId,
                    message: err?.message || 'Erreur inconnue'
                });
            } finally{
                if (tempDir) {
                    try {
                        await _fs.promises.rm(tempDir, {
                            recursive: true,
                            force: true
                        });
                    } catch  {
                    // ignore
                    }
                }
            }
        }
        if (changed) {
            next.updatedAt = new Date().toISOString();
            await this.writeManifest(next);
            await this.notifications.notifyAll('sounds.updated', {
                soundId: null,
                sha256: null,
                url: null,
                updatedAt: next.updatedAt
            });
        }
        return {
            ok: true,
            updated: updated.length,
            skipped: skipped.length,
            missing: missing.length,
            invalid: invalid.length,
            errors: errors.length,
            details: {
                updated,
                skipped,
                missing,
                invalid,
                errors
            }
        };
    }
    async diagnoseSounds() {
        const manifest = await this.readManifest();
        const root = this.dataRoot();
        const manifestPath = _path.join(root, 'manifest.json');
        const sounds = [];
        const missing = [];
        for (const soundId of _soundstypes.SOUND_KEYS){
            const entry = manifest.sounds?.[soundId];
            const sha256 = entry?.sha256 ?? null;
            const filePath = sha256 ? _fs.existsSync(_path.join(root, soundId, `${sha256}.wav`)) ? _path.join(root, soundId, `${sha256}.wav`) : _path.join(root, soundId, `${sha256}.mp3`) : null;
            let exists = false;
            let bytes = null;
            if (filePath) {
                try {
                    const stat = await _fs.promises.stat(filePath);
                    exists = stat.isFile();
                    bytes = stat.size;
                } catch  {
                    exists = false;
                }
            }
            if (entry?.sha256 && !exists) {
                missing.push(soundId);
            }
            sounds.push({
                soundId,
                inManifest: Boolean(entry?.sha256),
                sha256,
                filePath,
                exists,
                bytes,
                url: entry?.url ?? null,
                uploadedAt: entry?.uploadedAt ?? null
            });
        }
        return {
            ok: true,
            dataRoot: root,
            manifestPath,
            manifestUpdatedAt: manifest.updatedAt ?? new Date().toISOString(),
            total: sounds.length,
            missing,
            sounds
        };
    }
    async cleanupUnusedSounds() {
        const root = this.dataRoot();
        const manifest = await this.readManifest();
        const usedById = {};
        for (const key of _soundstypes.SOUND_KEYS){
            const entry = manifest.sounds?.[key];
            if (!entry?.sha256) continue;
            usedById[key] = entry.sha256;
        }
        let deletedFiles = 0;
        let deletedDirs = 0;
        let dirs;
        try {
            dirs = await _fs.promises.readdir(root, {
                withFileTypes: true
            });
        } catch  {
            return {
                ok: true,
                deletedFiles: 0,
                deletedDirs: 0
            };
        }
        for (const dirent of dirs){
            if (!dirent.isDirectory()) continue;
            const name = dirent.name;
            const soundKey = _soundstypes.SOUND_KEYS.find((k)=>k === name);
            if (!soundKey) {
                try {
                    await _fs.promises.rm(_path.join(root, name), {
                        recursive: true,
                        force: true
                    });
                    deletedDirs++;
                } catch  {
                // ignore
                }
                continue;
            }
            const keepSha = usedById[soundKey];
            if (!keepSha) {
                // Aucun son configuré pour ce soundId => supprimer le dossier.
                try {
                    await _fs.promises.rm(_path.join(root, soundKey), {
                        recursive: true,
                        force: true
                    });
                    deletedDirs++;
                } catch  {
                // ignore
                }
                continue;
            }
            deletedFiles += await this.removeUnusedFilesForSoundId(soundKey, keepSha);
            // Si le dossier est vide après cleanup, supprimer.
            try {
                const remaining = await _fs.promises.readdir(_path.join(root, soundKey));
                if (remaining.length === 0) {
                    await _fs.promises.rm(_path.join(root, soundKey), {
                        recursive: true,
                        force: true
                    });
                    deletedDirs++;
                }
            } catch  {
            // ignore
            }
        }
        return {
            ok: true,
            deletedFiles,
            deletedDirs
        };
    }
    async resolveSoundFile(soundIdRaw, shaFromUrl) {
        const soundId = this.normalizeSoundKey(soundIdRaw);
        const manifest = await this.readManifest();
        const entry = manifest.sounds?.[soundId];
        if (!entry) {
            throw new _common.NotFoundException('Son non configuré.');
        }
        if (shaFromUrl && shaFromUrl !== entry.sha256) {
            // The client asked an old url; 404 encourages them to refresh manifest.
            throw new _common.NotFoundException('Version du son obsolète.');
        }
        const wav = _path.join(this.dataRoot(), soundId, `${entry.sha256}.wav`);
        const mp3 = _path.join(this.dataRoot(), soundId, `${entry.sha256}.mp3`);
        const filePath = _fs.existsSync(wav) ? wav : mp3;
        if (!_fs.existsSync(filePath)) {
            throw new _common.NotFoundException('Fichier son introuvable.');
        }
        const ext = filePath.toLowerCase().endsWith('.wav') ? '.wav' : '.mp3';
        return {
            entry,
            filePath,
            ext
        };
    }
    // Convenience for local dev: ensure data dir exists
    async ensureDirs() {
        await _fs.promises.mkdir(this.dataRoot(), {
            recursive: true
        });
    }
    constructor(notifications){
        this.notifications = notifications;
        this.logger = new _common.Logger(SoundsService.name);
        this.storageRoot = this.resolveDataRoot();
    }
};
SoundsService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _notificationservice.NotificationService === "undefined" ? Object : _notificationservice.NotificationService
    ])
], SoundsService);
