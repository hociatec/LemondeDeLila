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
import { tmpdir } from 'os';
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

  constructor(private readonly notifications: NotificationService) {}

  private dataRoot() {
    // IMPORTANT:
    // - Using process.cwd() makes the storage path depend on how the service is launched (systemd WorkingDirectory,
    //   deploy scripts, manual runs...). That can make admin-uploaded sounds appear to "disappear" after a restart
    //   because the server starts reading a different folder.
    // - Default to a stable path relative to the backend project root (works in both src/ and dist/).
    // - Allow overriding via env for prod setups.
    const override = String(process.env.LMDL_SOUNDS_DIR ?? '').trim();
    if (override) return path.resolve(override);
    return path.resolve(__dirname, '..', '..', 'data', 'sounds');
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

  private async probeDurationSeconds(filePath: string): Promise<number> {
    const ffprobePath = this.getFfprobePath();
    const res = await this.runProcess(
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
    const ffmpegPath = this.getFfmpegPath();
    const res = await this.runProcess(
      ffmpegPath,
      ['-hide_banner', '-i', filePath, '-af', 'volumedetect', '-f', 'null', '-'],
      20000,
    );
    const output = `${res.stderr}\n${res.stdout}`;
    const match = output.match(/max_volume:\s*([-\\w.]+)\s*dB/i);
    if (!match) {
      return false;
    }
    return String(match[1]).toLowerCase() === '-inf';
  }

  private async transcodeToStableMp3(
    inputPath: string,
  ): Promise<{ outputPath: string; tempDir: string }> {
    const ffmpegPath = this.getFfmpegPath();
    const tempDir = await fs.promises.mkdtemp(
      path.join(tmpdir(), 'lmdl-sound-'),
    );
    const outputPath = path.join(tempDir, 'sound.mp3');
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
        'libmp3lame',
        '-b:a',
        '192k',
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
        if (!file.toLowerCase().endsWith('.mp3')) continue;
        if (file === `${keepSha256}.mp3`) continue;
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
      const parsed = JSON.parse(raw.replace(/^\uFEFF/, '')) as any;
      const itemsRaw = Array.isArray(parsed?.items) ? parsed.items : [];
      const items: TableAmbienceDefinition[] = itemsRaw
        .map((it: any) => ({
          soundId: this.normalizeTableAmbienceKey(String(it?.soundId ?? '')),
          name: String(it?.name ?? '').trim(),
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
    return this.readTableAmbiences();
  }

  async createTableAmbience(nameRaw: string): Promise<TableAmbienceDefinition> {
    const name = String(nameRaw ?? '').trim();
    if (!name) {
      throw new BadRequestException("Nom d'ambiance requis.");
    }

    const current = await this.readTableAmbiences();
    const used = new Set(current.items.map((i) => i.soundId.toLowerCase()));
    const available = (SOUND_KEYS.filter((k) =>
      /^TableAmbience\d+$/.test(k),
    ) as TableAmbienceSoundKey[]).find((k) => !used.has(k.toLowerCase()));
    if (!available) {
      throw new BadRequestException(
        'Nombre maximum atteint (20 ambiances de table).',
      );
    }

    const created: TableAmbienceDefinition = { soundId: available, name };
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
    nextItems[idx] = { soundId: soundId as TableAmbienceSoundKey, name };
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

  async getPublicManifest(origin?: string | null): Promise<SoundManifest> {
    const manifest = await this.readManifest();

    // Ensure URLs are always correct for current host (optional).
    // If origin is provided (e.g. from reverse proxy), we can return absolute URLs; otherwise keep relative.
    if (!origin) {
      return manifest;
    }
    const sounds: SoundManifest['sounds'] = {};
    for (const key of SOUND_KEYS) {
      const entry = manifest.sounds?.[key];
      if (!entry) continue;
      sounds[key] = { ...entry, url: `${origin}${entry.url}` };
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
    if (ext !== '.mp3') {
      throw new BadRequestException('Seuls les fichiers .mp3 sont acceptÃ©s.');
    }

    const stat = await fs.promises.stat(tempFilePath);
    // Safety: keep reasonably small. Can be tuned.
    const maxBytes = 15 * 1024 * 1024;
    if (stat.size <= 0 || stat.size > maxBytes) {
      throw new BadRequestException(
        `Taille fichier invalide (max ${maxBytes} bytes).`,
      );
    }

    // Validate input and re-encode to a stable MP3 format.
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
      const transcoded = await this.transcodeToStableMp3(tempFilePath);
      outputPath = transcoded.outputPath;
      tempDir = transcoded.tempDir;

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

    const destName = `${sha256}.mp3`;
    const destPath = path.join(soundDir, destName);
    await fs.promises.writeFile(destPath, bytes);

    const entry: SoundManifestEntry = {
      soundId,
      sha256,
      bytes: encodedSize || bytes.length,
      uploadedAt: new Date().toISOString(),
      url: `/api/sounds/${encodeURIComponent(soundId)}/${sha256}.mp3`,
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

    // Nettoyage best-effort: si le son est supprimÃ© du manifest, supprimer aussi les fichiers associÃ©s.
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
      const srcPath = path.join(soundDir, `${entry.sha256}.mp3`);
      if (!fs.existsSync(srcPath)) {
        missing.push(soundId);
        continue;
      }

      let tempDir: string | null = null;
      try {
        const transcoded = await this.transcodeToStableMp3(srcPath);
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

        const destPath = path.join(soundDir, `${sha256}.mp3`);
        await fs.promises.mkdir(soundDir, { recursive: true });
        await fs.promises.writeFile(destPath, bytes);

        next.sounds[soundId] = {
          soundId,
          sha256,
          bytes: bytes.length,
          uploadedAt: new Date().toISOString(),
          url: `/api/sounds/${encodeURIComponent(soundId)}/${sha256}.mp3`,
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
      const srcPath = path.join(soundDir, `${entry.sha256}.mp3`);
      if (!fs.existsSync(srcPath)) {
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
        const transcoded = await this.transcodeToStableMp3(srcPath);
        tempDir = transcoded.tempDir;
        const outputPath = transcoded.outputPath;

        await this.validateSoundFile(outputPath);

        const bytes = await fs.promises.readFile(outputPath);
        const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');

        if (sha256 === entry.sha256) {
          skipped.push(soundId);
          continue;
        }

        const destPath = path.join(soundDir, `${sha256}.mp3`);
        await fs.promises.mkdir(soundDir, { recursive: true });
        await fs.promises.writeFile(destPath, bytes);

        next.sounds[soundId] = {
          soundId,
          sha256,
          bytes: bytes.length,
          uploadedAt: new Date().toISOString(),
          url: `/api/sounds/${encodeURIComponent(soundId)}/${sha256}.mp3`,
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
        // Aucun son configurÃ© pour ce soundId => supprimer le dossier.
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

      // Si le dossier est vide aprÃ¨s cleanup, supprimer.
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
      throw new NotFoundException('Son non configurÃ©.');
    }
    if (shaFromUrl && shaFromUrl !== entry.sha256) {
      // The client asked an old url; 404 encourages them to refresh manifest.
      throw new NotFoundException('Version du son obsolÃ¨te.');
    }
    const filePath = path.join(this.dataRoot(), soundId, `${entry.sha256}.mp3`);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Fichier son introuvable.');
    }
    return { entry, filePath };
  }

  // Convenience for local dev: ensure data dir exists
  async ensureDirs() {
    await fs.promises.mkdir(this.dataRoot(), { recursive: true });
  }
}
