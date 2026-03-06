import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { homedir, tmpdir } from 'os';
import * as path from 'path';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import {
  SOUND_KEYS,
  SoundKey,
  SoundManifest,
  SoundManifestEntry,
  TableAmbienceDefinition,
  TableAmbienceDefinitionsFile,
  TableAmbienceSoundKey,
} from './sounds.types';
import { NotificationService } from '../notification/services/notification.service';

@Injectable()
export class SoundsService {
  private readonly logger = new Logger(SoundsService.name);
  private readonly storageRoot: string;

  constructor(private readonly notifications: NotificationService) {
    this.storageRoot = this.resolveDataRoot();
  }

  private hasDirectoryEntries(dir: string): boolean {
    try {
      return fs.readdirSync(dir).length > 0;
    } catch {
      return false;
    }
  }

  private bootstrapPersistentStorage(
    legacyRoot: string,
    persistentRoot: string,
  ): void {
    if (path.resolve(legacyRoot) === path.resolve(persistentRoot)) {
      return;
    }

    try {
      if (
        this.hasDirectoryEntries(legacyRoot) &&
        !this.hasDirectoryEntries(persistentRoot)
      ) {
        fs.mkdirSync(path.dirname(persistentRoot), { recursive: true });
        fs.cpSync(legacyRoot, persistentRoot, {
          recursive: true,
          force: false,
          errorOnExist: false,
        });
      }
    } catch {
      // best-effort bootstrap
    }
  }

  private resolveDataRoot(): string {
    const override = String(process.env.LMDL_SOUNDS_DIR ?? '').trim();
    if (override) return path.resolve(override);

    const legacyRoot = path.resolve(__dirname, '..', '..', 'data', 'sounds');
    const nodeEnv = String(process.env.NODE_ENV ?? '')
      .trim()
      .toLowerCase();

    if (nodeEnv !== 'production') {
      return legacyRoot;
    }

    const persistentRoot =
      process.platform === 'win32'
        ? path.join(
            String(
              process.env.PROGRAMDATA ??
                path.join(homedir(), 'AppData', 'Local'),
            ),
            'lemonde-de-lila',
            'sounds',
          )
        : path.join(
            homedir(),
            '.local',
            'share',
            'lemonde-de-lila',
            'sounds',
          );

    this.bootstrapPersistentStorage(legacyRoot, persistentRoot);

    try {
      fs.mkdirSync(persistentRoot, { recursive: true });
      const testFile = path.join(
        persistentRoot,
        `.write-test-${process.pid}-${Date.now()}`,
      );
      fs.writeFileSync(testFile, 'ok', 'utf-8');
      fs.rmSync(testFile, { force: true });
      return persistentRoot;
    } catch (err) {
      this.logger.warn(
        `Persistent sounds dir not writable (${persistentRoot}); falling back to legacy (${legacyRoot}): ${String(
          (err as any)?.message ?? err,
        )}`,
      );
      return legacyRoot;
    }
  }

  private dataRoot() {
    return this.storageRoot;
  }

  private getFfmpegPath(): string {
    const candidate = (ffmpegStatic as unknown as string) || '';
    if (!candidate) {
      throw new InternalServerErrorException(
        'ffmpeg indisponible (validation audio requise).',
      );
    }
    return candidate;
  }

  private getFfprobePath(): string {
    const raw = ffprobeStatic as any;
    const candidate = raw?.path || raw;
    if (!candidate) {
      throw new InternalServerErrorException(
        'ffprobe indisponible (validation audio requise).',
      );
    }
    return candidate;
  }

  private async runProcess(
    command: string,
    args: string[],
    timeoutMs = 15000,
  ): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { windowsHide: true });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let finished = false;

      const timer = setTimeout(() => {
        if (finished) return;
        finished = true;
        try {
          child.kill('SIGKILL');
        } catch {
          // ignore
        }
        reject(new Error(`Process timeout after ${timeoutMs}ms: ${command}`));
      }, timeoutMs);

      child.stdout?.on('data', (d) => stdout.push(d));
      child.stderr?.on('data', (d) => stderr.push(d));
      child.on('error', (err) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        reject(err);
      });
      child.on('close', (code) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        resolve({
          code: typeof code === 'number' ? code : -1,
          stdout: Buffer.concat(stdout).toString('utf8'),
          stderr: Buffer.concat(stderr).toString('utf8'),
        });
      });
    });
  }

  private isSpawnExecutionError(err: unknown): boolean {
    const anyErr = err as any;
    const code = String(anyErr?.code ?? '').toUpperCase();
    return code === 'ENOENT' || code === 'EACCES' || code === 'EPERM';
  }

  private audioToolExecutionError(
    tool: 'ffmpeg' | 'ffprobe',
    err: unknown,
    hint?: string,
  ): InternalServerErrorException {
    const anyErr = err as any;
    const code = anyErr?.code ? ` (${String(anyErr.code)})` : '';
    const details = anyErr?.message ? `: ${String(anyErr.message)}` : '';
    const extra = hint ? ` ${hint}` : '';
    return new InternalServerErrorException(
      `Impossible d'exécuter ${tool}${code}${details}.${extra}`.trim(),
    );
  }

  private async readWavMeta(filePath: string): Promise<{
    durationSeconds: number;
    dataOffset: number;
    dataSize: number;
    bitsPerSample: number;
    audioFormat: number;
    byteRate: number;
  }> {
    const fh = await fs.promises.open(filePath, 'r');
    try {
      const headerSize = 256 * 1024;
      const buf = Buffer.allocUnsafe(headerSize);
      const { bytesRead } = await fh.read(buf, 0, headerSize, 0);
      const b = buf.subarray(0, bytesRead);

      if (b.length < 44) {
        throw new BadRequestException('Fichier WAV invalide (entête).');
      }
      if (
        b.toString('ascii', 0, 4) !== 'RIFF' ||
        b.toString('ascii', 8, 12) !== 'WAVE'
      ) {
        throw new BadRequestException('Fichier WAV invalide (RIFF/WAVE).');
      }

      let pos = 12;
      let audioFormat = 0;
      let bitsPerSample = 0;
      let byteRate = 0;
      let dataOffset = -1;
      let dataSize = 0;

      while (pos + 8 <= b.length) {
        const chunkId = b.toString('ascii', pos, pos + 4);
        const chunkSize = b.readUInt32LE(pos + 4);
        pos += 8;

        if (chunkId === 'fmt ') {
          if (pos + 16 > b.length) {
            throw new BadRequestException('Fichier WAV invalide (fmt).');
          }
          audioFormat = b.readUInt16LE(pos + 0);
          const numChannels = b.readUInt16LE(pos + 2);
          const sampleRate = b.readUInt32LE(pos + 4);
          byteRate = b.readUInt32LE(pos + 8);
          bitsPerSample = b.readUInt16LE(pos + 14);

          if (!numChannels || !sampleRate || !byteRate || !bitsPerSample) {
            throw new BadRequestException('Fichier WAV invalide (fmt).');
          }
          if (audioFormat !== 1 && audioFormat !== 3) {
            throw new BadRequestException(
              'Format WAV non supporté (seulement PCM/Float).',
            );
          }
        } else if (chunkId === 'data') {
          dataOffset = pos;
          dataSize = chunkSize;
        }

        // Chunk sizes are padded to word boundary.
        pos += chunkSize + (chunkSize % 2);

        if (audioFormat && dataOffset >= 0) break;
      }

      if (!audioFormat || dataOffset < 0 || dataSize <= 0 || !byteRate) {
        throw new BadRequestException('Fichier WAV invalide (données).');
      }

      const durationSeconds = dataSize / byteRate;
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        throw new BadRequestException('Fichier WAV invalide (durée nulle).');
      }

      return {
        durationSeconds,
        dataOffset,
        dataSize,
        bitsPerSample,
        audioFormat,
        byteRate,
      };
    } finally {
      await fh.close().catch(() => undefined);
    }
  }

  private async isWavSilent(filePath: string): Promise<boolean> {
    const meta = await this.readWavMeta(filePath);
    const silenceByte =
      meta.bitsPerSample === 8 && meta.audioFormat === 1 ? 0x80 : 0x00;
    const segmentSize = Math.min(64 * 1024, meta.dataSize);
    const offsets = [
      meta.dataOffset,
      meta.dataOffset +
        Math.max(
          0,
          Math.floor(meta.dataSize / 2) - Math.floor(segmentSize / 2),
        ),
      meta.dataOffset + Math.max(0, meta.dataSize - segmentSize),
    ];

    const fh = await fs.promises.open(filePath, 'r');
    try {
      const buf = Buffer.allocUnsafe(segmentSize);
      for (const off of offsets) {
        const { bytesRead } = await fh.read(buf, 0, segmentSize, off);
        if (bytesRead <= 0) {
          throw new BadRequestException('Fichier WAV invalide (lecture).');
        }
        const slice = buf.subarray(0, bytesRead);
        for (let i = 0; i < slice.length; i++) {
          if (slice[i] !== silenceByte) {
            return false;
          }
        }
      }
      return true;
    } finally {
      await fh.close().catch(() => undefined);
    }
  }

  private async probeDurationSeconds(filePath: string): Promise<number> {
    const ext = path.extname(filePath).toLowerCase();
    let ffprobePath: string;
    try {
      ffprobePath = this.getFfprobePath();
    } catch (err) {
      if (ext === '.wav' || ext === '.wave') {
        return (await this.readWavMeta(filePath)).durationSeconds;
      }
      throw err;
    }
    let res: { code: number; stdout: string; stderr: string };
    try {
      res = await this.runProcess(
        ffprobePath,
        [
          '-v',
          'error',
          '-show_entries',
          'format=duration',
          '-of',
          'default=nw=1:nk=1',
          filePath,
        ],
        10000,
      );
    } catch (err) {
      if (this.isSpawnExecutionError(err) && (ext === '.wav' || ext === '.wave')) {
        return (await this.readWavMeta(filePath)).durationSeconds;
      }
      throw this.audioToolExecutionError(
        'ffprobe',
        err,
        "Utilisez un fichier .wav si ffprobe est bloqué sur ce serveur.",
      );
    }
    if (res.code !== 0) {
      this.logger.warn(`ffprobe failed: ${res.stderr || res.stdout}`);
      throw new BadRequestException(
        'Fichier audio invalide (durée illisible).',
      );
    }
    const duration = Number.parseFloat(String(res.stdout).trim());
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new BadRequestException('Fichier audio invalide (durée nulle).');
    }
    return duration;
  }

  private async detectSilence(filePath: string): Promise<boolean> {
    const ext = path.extname(filePath).toLowerCase();
    let ffmpegPath: string;
    try {
      ffmpegPath = this.getFfmpegPath();
    } catch (err) {
      if (ext === '.wav' || ext === '.wave') {
        return await this.isWavSilent(filePath);
      }
      throw err;
    }
    let res: { code: number; stdout: string; stderr: string };
    try {
      res = await this.runProcess(
        ffmpegPath,
        [
          '-hide_banner',
          '-i',
          filePath,
          '-af',
          'volumedetect',
          '-f',
          'null',
          '-',
        ],
        20000,
      );
    } catch (err) {
      if (this.isSpawnExecutionError(err) && (ext === '.wav' || ext === '.wave')) {
        return await this.isWavSilent(filePath);
      }
      throw this.audioToolExecutionError(
        'ffmpeg',
        err,
        "Utilisez un fichier .wav si ffmpeg est bloqué sur ce serveur.",
      );
    }
    const output = `${res.stderr}\n${res.stdout}`;
    const match = output.match(/max_volume:\s*([-\\w.]+)\s*dB/i);
    if (!match) {
      return false;
    }
    return String(match[1]).toLowerCase() === '-inf';
  }

  private async transcodeToStableWav(
    inputPath: string,
  ): Promise<{ outputPath: string; tempDir: string }> {
    const ffmpegPath = this.getFfmpegPath();
    const tempDir = await fs.promises.mkdtemp(
      path.join(tmpdir(), 'lmdl-sound-'),
    );
    const outputPath = path.join(tempDir, 'sound.wav');
    const res = await this.runProcess(
      ffmpegPath,
      [
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
        outputPath,
      ],
      30000,
    );
    if (res.code !== 0) {
      this.logger.warn(`ffmpeg transcode failed: ${res.stderr || res.stdout}`);
      throw new BadRequestException('Fichier audio invalide (transcodage).');
    }
    return { outputPath, tempDir };
  }

  private async removeUnusedFilesForSoundId(
    soundId: SoundKey,
    keepSha256: string,
  ): Promise<number> {
    const soundDir = path.join(this.dataRoot(), soundId);
    let deleted = 0;
    try {
      const files = await fs.promises.readdir(soundDir);
      for (const file of files) {
        const lower = file.toLowerCase();
        if (!(lower.endsWith('.wav') || lower.endsWith('.mp3'))) continue;
        if (file === `${keepSha256}.wav`) continue;
        try {
          await fs.promises.rm(path.join(soundDir, file), { force: true });
          deleted++;
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
    return deleted;
  }

  private manifestPath() {
    return path.join(this.dataRoot(), 'manifest.json');
  }

  private tableAmbiencesPath() {
    return path.join(this.dataRoot(), 'table-ambiences.json');
  }
  private normalizeSoundKey(input: string): SoundKey {
    const raw = (input || '').trim();
    const found = SOUND_KEYS.find((k) => k.toLowerCase() === raw.toLowerCase());
    if (!found) {
      throw new BadRequestException(`soundId invalide: ${raw}`);
    }
    return found;
  }

  private normalizeTableAmbienceKey(input: string): TableAmbienceSoundKey {
    const soundId = this.normalizeSoundKey(input);
    if (!/^TableAmbience\d+$/i.test(soundId)) {
      throw new BadRequestException(`Ambiance de table invalide: ${soundId}`);
    }
    return soundId as TableAmbienceSoundKey;
  }

  private async readManifest(): Promise<SoundManifest> {
    const file = this.manifestPath();
    try {
      const raw = await fs.promises.readFile(file, 'utf-8');
      const parsed = JSON.parse(raw.replace(/^\uFEFF/, '')) as SoundManifest;
      if (!parsed?.sounds || typeof parsed?.sounds !== 'object') {
        throw new Error('manifest invalide');
      }
      return parsed;
    } catch {
      return { updatedAt: new Date().toISOString(), sounds: {} };
    }
  }

  private async writeManifest(next: SoundManifest): Promise<void> {
    const root = this.dataRoot();
    await fs.promises.mkdir(root, { recursive: true });
    await fs.promises.writeFile(
      this.manifestPath(),
      JSON.stringify(next, null, 2),
      'utf-8',
    );
  }

  private async readTableAmbiences(): Promise<TableAmbienceDefinitionsFile> {
    const file = this.tableAmbiencesPath();
    try {
      const raw = await fs.promises.readFile(file, 'utf-8');
      const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
      const itemsRaw = Array.isArray(parsed?.items) ? parsed.items : [];
      const items: TableAmbienceDefinition[] = itemsRaw
        .map((it: any) => ({
          soundId: this.normalizeTableAmbienceKey(String(it?.soundId ?? '')),
          name: String(it?.name ?? '').trim(),
          enabled: typeof it?.enabled === 'boolean' ? it.enabled : true,
        }))
        .filter((it: TableAmbienceDefinition) => it.soundId && it.name);

      const seen = new Set<string>();
      const deduped: TableAmbienceDefinition[] = [];
      for (const it of items) {
        const k = it.soundId.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        deduped.push(it);
      }

      return {
        updatedAt:
          typeof parsed?.updatedAt === 'string' && parsed.updatedAt.trim()
            ? parsed.updatedAt
            : new Date().toISOString(),
        items: deduped,
      };
    } catch {
      return { updatedAt: new Date().toISOString(), items: [] };
    }
  }

  private async writeTableAmbiences(next: TableAmbienceDefinitionsFile) {
    const root = this.dataRoot();
    await fs.promises.mkdir(root, { recursive: true });
    await fs.promises.writeFile(
      this.tableAmbiencesPath(),
      JSON.stringify(next, null, 2),
      'utf-8',
    );
  }

  async listTableAmbiences(): Promise<TableAmbienceDefinitionsFile> {
    return this.listTableAmbiencesWithFilter();
  }

  async listTableAmbiencesWithFilter(options?: {
    includeDisabled?: boolean;
  }): Promise<TableAmbienceDefinitionsFile> {
    const current = await this.readTableAmbiences();
    if (options?.includeDisabled === true) {
      return current;
    }

    return {
      ...current,
      items: current.items.filter((it) => it.enabled !== false),
    };
  }

  async createTableAmbience(nameRaw: string): Promise<TableAmbienceDefinition> {
    const name = String(nameRaw ?? '').trim();
    if (!name) {
      throw new BadRequestException("Nom d'ambiance requis.");
    }

    const current = await this.readTableAmbiences();
    const used = new Set(current.items.map((i) => i.soundId.toLowerCase()));
    const available = (
      SOUND_KEYS.filter((k) =>
        /^TableAmbience\d+$/.test(k),
      ) as TableAmbienceSoundKey[]
    ).find((k) => !used.has(k.toLowerCase()));
    if (!available) {
      throw new BadRequestException(
        'Nombre maximum atteint (20 ambiances de table).',
      );
    }

    const created: TableAmbienceDefinition = {
      soundId: available,
      name,
      enabled: true,
    };
    const next: TableAmbienceDefinitionsFile = {
      updatedAt: new Date().toISOString(),
      items: [...current.items, created],
    };
    await this.writeTableAmbiences(next);

    await this.notifications.notifyAll('sounds.tableAmbiences.updated', {
      updatedAt: next.updatedAt,
    });

    return created;
  }

  async renameTableAmbience(
    soundIdRaw: string,
    nameRaw: string,
  ): Promise<TableAmbienceDefinition> {
    const soundId = this.normalizeTableAmbienceKey(soundIdRaw);
    const name = String(nameRaw ?? '').trim();
    if (!name) {
      throw new BadRequestException("Nom d'ambiance requis.");
    }

    const current = await this.readTableAmbiences();
    const idx = current.items.findIndex(
      (i) => i.soundId.toLowerCase() === soundId.toLowerCase(),
    );
    if (idx < 0) {
      throw new NotFoundException('Ambiance de table introuvable.');
    }

    const nextItems = [...current.items];
    nextItems[idx] = {
      soundId: soundId,
      name,
      enabled: nextItems[idx]?.enabled !== false,
    };
    const next: TableAmbienceDefinitionsFile = {
      updatedAt: new Date().toISOString(),
      items: nextItems,
    };
    await this.writeTableAmbiences(next);

    await this.notifications.notifyAll('sounds.tableAmbiences.updated', {
      updatedAt: next.updatedAt,
    });

    return nextItems[idx];
  }

  async deleteTableAmbience(soundIdRaw: string): Promise<{ ok: true }> {
    const soundId = this.normalizeTableAmbienceKey(soundIdRaw);

    const current = await this.readTableAmbiences();
    const nextItems = current.items.filter(
      (i) => i.soundId.toLowerCase() !== soundId.toLowerCase(),
    );
    const next: TableAmbienceDefinitionsFile = {
      updatedAt: new Date().toISOString(),
      items: nextItems,
    };
    await this.writeTableAmbiences(next);

    // Also clear associated sound to free the slot completely.
    await this.clearSound(soundId);

    await this.notifications.notifyAll('sounds.tableAmbiences.updated', {
      updatedAt: next.updatedAt,
    });

    return { ok: true };
  }

  async setTableAmbienceEnabled(
    soundIdRaw: string,
    enabled: boolean,
  ): Promise<TableAmbienceDefinition> {
    const soundId = this.normalizeTableAmbienceKey(soundIdRaw);
    const current = await this.readTableAmbiences();
    const idx = current.items.findIndex(
      (i) => i.soundId.toLowerCase() === soundId.toLowerCase(),
    );
    if (idx < 0) {
      throw new NotFoundException('Ambiance de table introuvable.');
    }

    const nextItems = [...current.items];
    nextItems[idx] = {
      ...nextItems[idx],
      enabled: enabled === true,
    };
    const next: TableAmbienceDefinitionsFile = {
      updatedAt: new Date().toISOString(),
      items: nextItems,
    };
    await this.writeTableAmbiences(next);

    await this.notifications.notifyAll('sounds.tableAmbiences.updated', {
      updatedAt: next.updatedAt,
    });

    return nextItems[idx];
  }

  async getPublicManifest(origin?: string | null): Promise<SoundManifest> {
    const manifest = await this.readManifest();

    // Always filter to known keys and only publish entries that have an on-disk file.
    // This prevents the client from trying to download sounds that were removed from disk
    // but accidentally left behind in the manifest.
    const sounds: SoundManifest['sounds'] = {};
    for (const key of SOUND_KEYS) {
      const entry = manifest.sounds?.[key];
      if (!entry) continue;

      const root = this.dataRoot();
      const soundDir = path.join(root, entry.soundId);
      const wav = path.join(soundDir, `${entry.sha256}.wav`);
      const mp3 = path.join(soundDir, `${entry.sha256}.mp3`);
      if (!fs.existsSync(wav) && !fs.existsSync(mp3)) {
        continue;
      }

      sounds[key] = origin ? { ...entry, url: `${origin}${entry.url}` } : entry;
    }

    return { ...manifest, sounds };
  }

  async setSound(
    soundIdRaw: string,
    tempFilePath: string,
    originalName?: string,
  ) {
    const soundId = this.normalizeSoundKey(soundIdRaw);
    if (!tempFilePath || !fs.existsSync(tempFilePath)) {
      throw new BadRequestException('Fichier manquant.');
    }

    const ext = path.extname(originalName || tempFilePath).toLowerCase();
    if (ext !== '.mp3' && ext !== '.wav' && ext !== '.wave') {
      throw new BadRequestException(
        'Seuls les fichiers .mp3, .wav ou .wave sont acceptés.',
      );
    }
    const isWavInput = ext === '.wav' || ext === '.wave';

    const stat = await fs.promises.stat(tempFilePath);
    // Safety: keep reasonably small. Can be tuned.
    // WAV is much larger than MP3 (PCM). Keep this high; admin-only endpoint.
    const maxBytes = 250 * 1024 * 1024;
    if (stat.size <= 0 || stat.size > maxBytes) {
      throw new BadRequestException(
        `Taille fichier invalide (max ${maxBytes} bytes).`,
      );
    }

    // Validate input and re-encode to a stable WAV (PCM) format.
    const minDurationSeconds = 0.2;
    const inputDuration = await this.probeDurationSeconds(tempFilePath);
    if (inputDuration < minDurationSeconds) {
      throw new BadRequestException('Son trop court (min 200ms).');
    }

    let bytes = Buffer.alloc(0);
    let sha256 = '';
    let encodedSize = 0;
    let tempDir: string | null = null;
    let outputPath = tempFilePath;
    try {
      try {
        const transcoded = await this.transcodeToStableWav(tempFilePath);
        outputPath = transcoded.outputPath;
        tempDir = transcoded.tempDir;
      } catch (err) {
        // Fallback: allow WAV upload even if ffmpeg is blocked/unavailable on the host.
        if (
          isWavInput &&
          (this.isSpawnExecutionError(err) ||
            err instanceof InternalServerErrorException)
        ) {
          outputPath = tempFilePath;
          tempDir = null;
        } else if (this.isSpawnExecutionError(err)) {
          throw this.audioToolExecutionError(
            'ffmpeg',
            err,
            "Utilisez un fichier .wav si ffmpeg est bloqué sur ce serveur.",
          );
        } else {
          throw err;
        }
      }

      const encodedStat = await fs.promises.stat(outputPath);
      if (encodedStat.size <= 0 || encodedStat.size > maxBytes) {
        throw new BadRequestException(
          `Taille fichier invalide après transcodage (max ${maxBytes} bytes).`,
        );
      }
      encodedSize = encodedStat.size;

      const duration = await this.probeDurationSeconds(outputPath);
      if (duration < minDurationSeconds) {
        throw new BadRequestException('Son trop court après transcodage.');
      }

      const isSilent = await this.detectSilence(outputPath);
      if (isSilent) {
        throw new BadRequestException('Son silencieux (volume max = -inf).');
      }

      bytes = await fs.promises.readFile(outputPath);
      sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    } finally {
      if (tempDir) {
        try {
          await fs.promises.rm(tempDir, { recursive: true, force: true });
        } catch {
          // ignore
        }
      }
    }

    const root = this.dataRoot();
    const soundDir = path.join(root, soundId);
    await fs.promises.mkdir(soundDir, { recursive: true });

    const destName = `${sha256}.wav`;
    const destPath = path.join(soundDir, destName);
    await fs.promises.writeFile(destPath, bytes);

    const entry: SoundManifestEntry = {
      soundId,
      sha256,
      bytes: encodedSize || bytes.length,
      uploadedAt: new Date().toISOString(),
      url: `/api/sounds/${encodeURIComponent(soundId)}/${sha256}.wav`,
    };

    const manifest = await this.readManifest();
    const next: SoundManifest = {
      updatedAt: new Date().toISOString(),
      sounds: { ...(manifest.sounds || {}), [soundId]: entry },
    };
    await this.writeManifest(next);

    // Nettoyage: supprimer les anciennes versions non référencées (doublons) pour ce soundId.
    await this.removeUnusedFilesForSoundId(soundId, sha256);

    await this.notifications.notifyAll('sounds.updated', {
      soundId,
      sha256,
      url: entry.url,
      updatedAt: next.updatedAt,
    });

    return entry;
  }

  async clearSound(soundIdRaw: string) {
    const soundId = this.normalizeSoundKey(soundIdRaw);
    const manifest = await this.readManifest();
    if (!manifest.sounds?.[soundId]) {
      return { ok: true };
    }
    const next = {
      updatedAt: new Date().toISOString(),
      sounds: { ...(manifest.sounds || {}) },
    } as SoundManifest;
    delete next.sounds[soundId];
    await this.writeManifest(next);

    // Nettoyage best-effort: si le son est supprimé du manifest, supprimer aussi les fichiers associés.
    try {
      await fs.promises.rm(path.join(this.dataRoot(), soundId), {
        recursive: true,
        force: true,
      });
    } catch {
      // ignore
    }

    await this.notifications.notifyAll('sounds.updated', {
      soundId,
      sha256: null,
      url: null,
      updatedAt: next.updatedAt,
    });
    return { ok: true };
  }

  async reencodeAllSounds(): Promise<{
    ok: true;
    updated: number;
    skipped: number;
    missing: number;
    errors: number;
    details: {
      updated: string[];
      skipped: string[];
      missing: string[];
      errors: { soundId: string; message: string }[];
    };
  }> {
    const manifest = await this.readManifest();
    const next: SoundManifest = {
      updatedAt: manifest.updatedAt,
      sounds: { ...(manifest.sounds || {}) },
    };

    const updated: string[] = [];
    const skipped: string[] = [];
    const missing: string[] = [];
    const errors: { soundId: string; message: string }[] = [];
    let changed = false;

    for (const soundId of SOUND_KEYS) {
      const entry = manifest.sounds?.[soundId];
      if (!entry?.sha256) {
        continue;
      }

      const soundDir = path.join(this.dataRoot(), soundId);
      const srcPathWav = path.join(soundDir, `${entry.sha256}.wav`);
      const srcPathMp3 = path.join(soundDir, `${entry.sha256}.mp3`);
      const srcPath = fs.existsSync(srcPathWav)
        ? srcPathWav
        : fs.existsSync(srcPathMp3)
          ? srcPathMp3
          : null;
      if (!srcPath) {
        missing.push(soundId);
        continue;
      }

      let tempDir: string | null = null;
      try {
        const transcoded = await this.transcodeToStableWav(srcPath);
        tempDir = transcoded.tempDir;
        const outputPath = transcoded.outputPath;

        const duration = await this.probeDurationSeconds(outputPath);
        if (duration < 0.2) {
          throw new BadRequestException('Son trop court après transcodage.');
        }
        const isSilent = await this.detectSilence(outputPath);
        if (isSilent) {
          throw new BadRequestException('Son silencieux (volume max = -inf).');
        }

        const bytes = await fs.promises.readFile(outputPath);
        const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');

        if (sha256 === entry.sha256) {
          skipped.push(soundId);
          continue;
        }

        const destPath = path.join(soundDir, `${sha256}.wav`);
        await fs.promises.mkdir(soundDir, { recursive: true });
        await fs.promises.writeFile(destPath, bytes);

        next.sounds[soundId] = {
          soundId,
          sha256,
          bytes: bytes.length,
          uploadedAt: new Date().toISOString(),
          url: `/api/sounds/${encodeURIComponent(soundId)}/${sha256}.wav`,
        };

        await this.removeUnusedFilesForSoundId(soundId, sha256);
        updated.push(soundId);
        changed = true;
      } catch (err: any) {
        errors.push({
          soundId,
          message: err?.message || 'Erreur inconnue',
        });
      } finally {
        if (tempDir) {
          try {
            await fs.promises.rm(tempDir, { recursive: true, force: true });
          } catch {
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
        updatedAt: next.updatedAt,
      });
    }

    return {
      ok: true,
      updated: updated.length,
      skipped: skipped.length,
      missing: missing.length,
      errors: errors.length,
      details: { updated, skipped, missing, errors },
    };
  }

  private async validateSoundFile(filePath: string): Promise<void> {
    const minDurationSeconds = 0.2;
    const duration = await this.probeDurationSeconds(filePath);
    if (duration < minDurationSeconds) {
      throw new BadRequestException('Son trop court (min 200ms).');
    }
    const isSilent = await this.detectSilence(filePath);
    if (isSilent) {
      throw new BadRequestException('Son silencieux (volume max = -inf).');
    }
  }

  async reencodeInvalidSounds(): Promise<{
    ok: true;
    updated: number;
    skipped: number;
    missing: number;
    invalid: number;
    errors: number;
    details: {
      updated: string[];
      skipped: string[];
      missing: string[];
      invalid: string[];
      errors: { soundId: string; message: string }[];
    };
  }> {
    const manifest = await this.readManifest();
    const next: SoundManifest = {
      updatedAt: manifest.updatedAt,
      sounds: { ...(manifest.sounds || {}) },
    };

    const updated: string[] = [];
    const skipped: string[] = [];
    const missing: string[] = [];
    const invalid: string[] = [];
    const errors: { soundId: string; message: string }[] = [];
    let changed = false;

    for (const soundId of SOUND_KEYS) {
      const entry = manifest.sounds?.[soundId];
      if (!entry?.sha256) {
        continue;
      }

      const soundDir = path.join(this.dataRoot(), soundId);
      const srcPathWav = path.join(soundDir, `${entry.sha256}.wav`);
      const srcPathMp3 = path.join(soundDir, `${entry.sha256}.mp3`);
      const srcPath = fs.existsSync(srcPathWav)
        ? srcPathWav
        : fs.existsSync(srcPathMp3)
          ? srcPathMp3
          : null;
      if (!srcPath) {
        missing.push(soundId);
        continue;
      }

      let needsFix = false;
      try {
        await this.validateSoundFile(srcPath);
      } catch {
        needsFix = true;
        invalid.push(soundId);
      }

      if (!needsFix) {
        skipped.push(soundId);
        continue;
      }

      let tempDir: string | null = null;
      try {
        const transcoded = await this.transcodeToStableWav(srcPath);
        tempDir = transcoded.tempDir;
        const outputPath = transcoded.outputPath;

        await this.validateSoundFile(outputPath);

        const bytes = await fs.promises.readFile(outputPath);
        const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');

        if (sha256 === entry.sha256) {
          skipped.push(soundId);
          continue;
        }

        const destPath = path.join(soundDir, `${sha256}.wav`);
        await fs.promises.mkdir(soundDir, { recursive: true });
        await fs.promises.writeFile(destPath, bytes);

        next.sounds[soundId] = {
          soundId,
          sha256,
          bytes: bytes.length,
          uploadedAt: new Date().toISOString(),
          url: `/api/sounds/${encodeURIComponent(soundId)}/${sha256}.wav`,
        };

        await this.removeUnusedFilesForSoundId(soundId, sha256);
        updated.push(soundId);
        changed = true;
      } catch (err: any) {
        errors.push({
          soundId,
          message: err?.message || 'Erreur inconnue',
        });
      } finally {
        if (tempDir) {
          try {
            await fs.promises.rm(tempDir, { recursive: true, force: true });
          } catch {
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
        updatedAt: next.updatedAt,
      });
    }

    return {
      ok: true,
      updated: updated.length,
      skipped: skipped.length,
      missing: missing.length,
      invalid: invalid.length,
      errors: errors.length,
      details: { updated, skipped, missing, invalid, errors },
    };
  }

  async diagnoseSounds(): Promise<{
    ok: true;
    dataRoot: string;
    manifestPath: string;
    manifestUpdatedAt: string;
    total: number;
    missing: string[];
    sounds: {
      soundId: string;
      inManifest: boolean;
      sha256?: string | null;
      filePath?: string | null;
      exists: boolean;
      bytes?: number | null;
      url?: string | null;
      uploadedAt?: string | null;
    }[];
  }> {
    const manifest = await this.readManifest();
    const root = this.dataRoot();
    const manifestPath = path.join(root, 'manifest.json');

    const sounds: {
      soundId: string;
      inManifest: boolean;
      sha256?: string | null;
      filePath?: string | null;
      exists: boolean;
      bytes?: number | null;
      url?: string | null;
      uploadedAt?: string | null;
    }[] = [];
    const missing: string[] = [];

    for (const soundId of SOUND_KEYS) {
      const entry = manifest.sounds?.[soundId];
      const sha256 = entry?.sha256 ?? null;
      const filePath = sha256
        ? fs.existsSync(path.join(root, soundId, `${sha256}.wav`))
          ? path.join(root, soundId, `${sha256}.wav`)
          : path.join(root, soundId, `${sha256}.mp3`)
        : null;
      let exists = false;
      let bytes: number | null = null;
      if (filePath) {
        try {
          const stat = await fs.promises.stat(filePath);
          exists = stat.isFile();
          bytes = stat.size;
        } catch {
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
        uploadedAt: entry?.uploadedAt ?? null,
      });
    }

    return {
      ok: true,
      dataRoot: root,
      manifestPath,
      manifestUpdatedAt: manifest.updatedAt ?? new Date().toISOString(),
      total: sounds.length,
      missing,
      sounds,
    };
  }

  async cleanupUnusedSounds(): Promise<{
    ok: true;
    deletedFiles: number;
    deletedDirs: number;
  }> {
    const root = this.dataRoot();
    const manifest = await this.readManifest();

    const usedById: Partial<Record<SoundKey, string>> = {};
    for (const key of SOUND_KEYS) {
      const entry = manifest.sounds?.[key];
      if (!entry?.sha256) continue;
      usedById[key] = entry.sha256;
    }

    let deletedFiles = 0;
    let deletedDirs = 0;

    let dirs: fs.Dirent[];
    try {
      dirs = await fs.promises.readdir(root, { withFileTypes: true });
    } catch {
      return { ok: true, deletedFiles: 0, deletedDirs: 0 };
    }

    for (const dirent of dirs) {
      if (!dirent.isDirectory()) continue;
      const name = dirent.name;
      const soundKey = SOUND_KEYS.find((k) => k === name);
      if (!soundKey) {
        try {
          await fs.promises.rm(path.join(root, name), {
            recursive: true,
            force: true,
          });
          deletedDirs++;
        } catch {
          // ignore
        }
        continue;
      }

      const keepSha = usedById[soundKey];
      if (!keepSha) {
        // Aucun son configuré pour ce soundId => supprimer le dossier.
        try {
          await fs.promises.rm(path.join(root, soundKey), {
            recursive: true,
            force: true,
          });
          deletedDirs++;
        } catch {
          // ignore
        }
        continue;
      }

      deletedFiles += await this.removeUnusedFilesForSoundId(soundKey, keepSha);

      // Si le dossier est vide après cleanup, supprimer.
      try {
        const remaining = await fs.promises.readdir(path.join(root, soundKey));
        if (remaining.length === 0) {
          await fs.promises.rm(path.join(root, soundKey), {
            recursive: true,
            force: true,
          });
          deletedDirs++;
        }
      } catch {
        // ignore
      }
    }

    return { ok: true, deletedFiles, deletedDirs };
  }

  async resolveSoundFile(soundIdRaw: string, shaFromUrl?: string | null) {
    const soundId = this.normalizeSoundKey(soundIdRaw);
    const manifest = await this.readManifest();
    const entry = manifest.sounds?.[soundId];
    if (!entry) {
      throw new NotFoundException('Son non configuré.');
    }
    if (shaFromUrl && shaFromUrl !== entry.sha256) {
      // The client asked an old url; 404 encourages them to refresh manifest.
      throw new NotFoundException('Version du son obsolète.');
    }
    const wav = path.join(this.dataRoot(), soundId, `${entry.sha256}.wav`);
    const mp3 = path.join(this.dataRoot(), soundId, `${entry.sha256}.mp3`);
    const filePath = fs.existsSync(wav) ? wav : mp3;
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Fichier son introuvable.');
    }
    const ext = filePath.toLowerCase().endsWith('.wav') ? '.wav' : '.mp3';
    return { entry, filePath, ext };
  }

  // Convenience for local dev: ensure data dir exists
  async ensureDirs() {
    await fs.promises.mkdir(this.dataRoot(), { recursive: true });
  }
}
