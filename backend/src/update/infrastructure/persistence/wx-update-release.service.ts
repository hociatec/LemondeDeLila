import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import {
  createHash,
  createPublicKey,
  randomUUID,
  verify as verifyCryptoSignature,
} from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import {
  compareUpdateVersions,
  parseUpdateVersion,
} from '../../domain/update-version';
import {
  canonicalizeWxUpdateSignature,
  WX_UPDATE_ARCHITECTURE,
  WX_UPDATE_CHANNEL,
  WX_UPDATE_PLATFORM,
  WX_UPDATE_PRODUCT,
  WX_UPDATE_SCHEMA_VERSION,
  WX_UPDATE_SIGNATURE_ALGORITHM,
  type WxUpdateManifest,
  type WxUpdateManifestResponse,
} from '../../domain/wx-update-manifest';

export type PublishWxUpdateInput = {
  zipPath: string;
  releaseId: string;
  version: string;
  sequence: number;
  publishedAt: string;
  message?: string | null;
  minimumVersion?: string | null;
  mandatoryAt?: string | null;
  expectedSha256: string;
  signature: string;
};

@Injectable()
export class WxUpdateReleaseService {
  private static readonly manifestCacheTtlMs = 5_000;
  private static readonly defaultMaxArtifactBytes = 2 * 1024 * 1024 * 1024;

  private readonly updatesDir: string;
  private readonly metaPath: string;
  private readonly publicUrl: string;
  private readonly maxArtifactBytes: number;
  private cachedManifest: WxUpdateManifest | null = null;
  private manifestCacheInitialized = false;
  private manifestCacheExpiresAt = 0;

  constructor() {
    const backendRoot = path.resolve(__dirname, '..', '..', '..', '..');
    const dataRoot = path.join(backendRoot, 'data', 'client-updates');
    this.updatesDir =
      (process.env.CLIENT_WX_UPDATES_DIR || '').trim() ||
      path.join(dataRoot, 'client-wx');
    this.metaPath =
      (process.env.CLIENT_WX_UPDATES_META_PATH || '').trim() ||
      path.join(dataRoot, 'client-wx-latest.json');
    this.publicUrl =
      (process.env.CLIENT_WX_UPDATES_PUBLIC_URL || '').trim() ||
      '/updates/client-wx';
    const configuredMax = Number(process.env.CLIENT_WX_MAX_ARTIFACT_BYTES);
    this.maxArtifactBytes =
      Number.isSafeInteger(configuredMax) && configuredMax > 0
        ? configuredMax
        : WxUpdateReleaseService.defaultMaxArtifactBytes;
  }

  getTargetDir(): string {
    return this.updatesDir;
  }

  getMaxArtifactBytes(): number {
    return this.maxArtifactBytes;
  }

  async getLatest(): Promise<WxUpdateManifest | null> {
    if (
      this.manifestCacheInitialized &&
      Date.now() < this.manifestCacheExpiresAt
    ) {
      return this.cachedManifest;
    }
    try {
      const raw = await fs.promises.readFile(this.metaPath, 'utf-8');
      const value = JSON.parse(raw.replace(/^\uFEFF/, '')) as unknown;
      if (this.isManifest(value) && this.verifyManifestSignature(value)) {
        this.updateManifestCache(value);
        return value;
      }
    } catch {
      // A transient filesystem failure must not erase the last known policy.
    }
    this.manifestCacheInitialized = true;
    this.manifestCacheExpiresAt =
      Date.now() + WxUpdateReleaseService.manifestCacheTtlMs;
    return this.cachedManifest;
  }

  async getMinimumVersion(): Promise<string | null> {
    const latest = await this.getLatest();
    const explicit = (process.env.CLIENT_WX_MIN_VERSION || '').trim();
    const candidates = [explicit, latest?.minimumVersion || ''].filter(
      (version) => parseUpdateVersion(version) != null,
    );
    return (
      candidates.sort(
        (left, right) => compareUpdateVersions(right, left) ?? 0,
      )[0] ?? null
    );
  }

  async getForClient(
    currentVersion: string | null,
    origin: string | null,
  ): Promise<WxUpdateManifestResponse | null> {
    const latest = await this.getLatest();
    if (!latest) return null;
    const current = (currentVersion || '').trim() || null;
    const comparison = current
      ? compareUpdateVersions(latest.version, current)
      : null;
    const minimumComparison =
      current && latest.minimumVersion
        ? compareUpdateVersions(current, latest.minimumVersion)
        : null;
    const updateAvailable = comparison == null ? null : comparison > 0;
    const updateRequired =
      latest.minimumVersion != null &&
      (current == null || minimumComparison == null || minimumComparison < 0);
    const deadlineReached =
      latest.mandatoryAt != null &&
      Date.parse(latest.mandatoryAt) <= Date.now();
    return {
      ...latest,
      artifact: {
        ...latest.artifact,
        url: this.resolvePublicUrl(latest.artifact.url, origin),
      },
      currentVersion: current,
      updateAvailable,
      updateRequired,
      mandatory:
        updateRequired || (deadlineReached && updateAvailable === true),
    };
  }

  async publish(input: PublishWxUpdateInput): Promise<WxUpdateManifest> {
    const releaseId = this.requireReleaseId(input.releaseId);
    const version = this.requireVersion(input.version, 'Version WX invalide.');
    const minimumVersion =
      (input.minimumVersion || '').trim() === ''
        ? null
        : this.requireVersion(
            input.minimumVersion!,
            'Version minimale WX invalide.',
          );
    if (
      minimumVersion &&
      (compareUpdateVersions(minimumVersion, version) ?? 1) > 0
    ) {
      throw new BadRequestException(
        'La version minimale WX dépasse la version publiée.',
      );
    }
    const sequence = Number(input.sequence);
    if (!Number.isSafeInteger(sequence) || sequence <= 0) {
      throw new BadRequestException('Séquence de publication WX invalide.');
    }
    const publishedAt = this.requireDate(
      input.publishedAt,
      'Date de publication WX invalide.',
    );
    const mandatoryAt = input.mandatoryAt
      ? this.requireDate(input.mandatoryAt, 'Date obligatoire WX invalide.')
      : null;
    const expectedSha256 = (input.expectedSha256 || '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(expectedSha256)) {
      throw new BadRequestException('SHA-256 WX invalide.');
    }
    const signature = (input.signature || '').trim();
    if (!signature || !this.isBase64(signature)) {
      throw new BadRequestException('Signature WX invalide ou absente.');
    }

    const stat = await fs.promises.stat(input.zipPath).catch(() => null);
    if (
      !stat?.isFile() ||
      stat.size <= 0 ||
      stat.size > this.maxArtifactBytes
    ) {
      throw new BadRequestException(
        'Archive WX absente, vide ou trop volumineuse.',
      );
    }
    await this.assertZipHeader(input.zipPath);
    const sha256 = await this.sha256(input.zipPath);
    if (expectedSha256 !== sha256) {
      throw new BadRequestException(
        "Empreinte SHA-256 de l'archive WX invalide.",
      );
    }

    return this.commitPublication({
      input,
      releaseId,
      version,
      sequence,
      publishedAt,
      mandatoryAt,
      minimumVersion,
      signature,
      sha256,
      artifactSize: stat.size,
    });
  }

  private async commitPublication(params: {
    input: PublishWxUpdateInput;
    releaseId: string;
    version: string;
    sequence: number;
    publishedAt: string;
    mandatoryAt: string | null;
    minimumVersion: string | null;
    signature: string;
    sha256: string;
    artifactSize: number;
  }): Promise<WxUpdateManifest> {
    const lock = await this.acquirePublicationLock();
    try {
      const previous = await this.readLatestFromDisk();
      if (
        previous?.releaseId === params.releaseId &&
        previous.sequence === params.sequence &&
        previous.artifact.sha256 === params.sha256
      ) {
        this.updateManifestCache(previous);
        return previous;
      }
      if (previous && params.sequence <= previous.sequence) {
        throw new ConflictException(
          `La séquence WX doit être supérieure à ${previous.sequence}.`,
        );
      }
      const signaturePayload = canonicalizeWxUpdateSignature({
        releaseId: params.releaseId,
        version: params.version,
        sequence: params.sequence,
        publishedAt: params.publishedAt,
        mandatoryAt: params.mandatoryAt,
        minimumVersion: params.minimumVersion,
        artifactSize: params.artifactSize,
        artifactSha256: params.sha256,
      });
      if (!this.verifySignature(signaturePayload, params.signature)) {
        throw new BadRequestException('Signature cryptographique WX invalide.');
      }

      const releasesDir = path.join(this.updatesDir, 'releases');
      const stagingDir = path.join(
        this.updatesDir,
        '.staging',
        params.releaseId,
      );
      const finalDir = path.join(releasesDir, params.releaseId);
      const fileName = `client-wx-${params.version}-windows-x64.zip`;
      const existingArtifact = path.join(finalDir, fileName);
      if (await this.pathExists(finalDir)) {
        const existingHash = await this.sha256(existingArtifact).catch(
          () => '',
        );
        if (existingHash !== params.sha256) {
          throw new ConflictException(
            'Cet identifiant de release WX existe avec un autre contenu.',
          );
        }
      } else {
        await fs.promises.mkdir(stagingDir, { recursive: true });
        try {
          await fs.promises.copyFile(
            params.input.zipPath,
            path.join(stagingDir, fileName),
          );
          await fs.promises.mkdir(releasesDir, { recursive: true });
          await fs.promises.rename(stagingDir, finalDir);
        } catch (error) {
          await fs.promises.rm(stagingDir, { recursive: true, force: true });
          throw error;
        }
      }

      const manifest: WxUpdateManifest = {
        schemaVersion: WX_UPDATE_SCHEMA_VERSION,
        product: WX_UPDATE_PRODUCT,
        platform: WX_UPDATE_PLATFORM,
        architecture: WX_UPDATE_ARCHITECTURE,
        channel: WX_UPDATE_CHANNEL,
        releaseId: params.releaseId,
        version: params.version,
        sequence: params.sequence,
        publishedAt: params.publishedAt,
        mandatoryAt: params.mandatoryAt,
        minimumVersion: params.minimumVersion,
        message: (params.input.message || '').trim() || null,
        artifact: {
          url: `${this.publicUrl.replace(/\/$/, '')}/releases/${encodeURIComponent(params.releaseId)}/${encodeURIComponent(fileName)}`,
          size: params.artifactSize,
          sha256: params.sha256,
          signature: params.signature,
          signatureAlgorithm: WX_UPDATE_SIGNATURE_ALGORITHM,
        },
      };
      await this.saveLatestAtomically(manifest);
      this.updateManifestCache(manifest);
      return manifest;
    } finally {
      await lock.close().catch(() => undefined);
      await fs.promises.rm(this.publicationLockPath(), { force: true });
    }
  }

  private updateManifestCache(manifest: WxUpdateManifest | null): void {
    this.cachedManifest = manifest;
    this.manifestCacheInitialized = true;
    this.manifestCacheExpiresAt =
      Date.now() + WxUpdateReleaseService.manifestCacheTtlMs;
  }

  private publicationLockPath(): string {
    return path.join(this.updatesDir, '.publish.lock');
  }

  private async acquirePublicationLock(): Promise<fs.promises.FileHandle> {
    await fs.promises.mkdir(this.updatesDir, { recursive: true });
    try {
      return await fs.promises.open(this.publicationLockPath(), 'wx');
    } catch {
      const stat = await fs.promises
        .stat(this.publicationLockPath())
        .catch(() => null);
      if (stat && stat.mtimeMs < Date.now() - 2 * 60 * 60 * 1000) {
        await fs.promises.rm(this.publicationLockPath(), { force: true });
        try {
          return await fs.promises.open(this.publicationLockPath(), 'wx');
        } catch {
          // Another instance recovered the stale lock first.
        }
      }
      throw new ConflictException('Une publication WX est déjà en cours.');
    }
  }

  private async readLatestFromDisk(): Promise<WxUpdateManifest | null> {
    try {
      const value = JSON.parse(
        await fs.promises.readFile(this.metaPath, 'utf-8'),
      ) as unknown;
      return this.isManifest(value) && this.verifyManifestSignature(value)
        ? value
        : null;
    } catch {
      return null;
    }
  }

  private resolvePublicUrl(value: string, origin: string | null): string {
    if (/^https:\/\//i.test(value)) return value;
    if (origin && value.startsWith('/')) {
      return `${origin.replace(/\/$/, '')}${value}`;
    }
    return value;
  }

  private async saveLatestAtomically(
    manifest: WxUpdateManifest,
  ): Promise<void> {
    await fs.promises.mkdir(path.dirname(this.metaPath), { recursive: true });
    const temporary = `${this.metaPath}.${process.pid}.${randomUUID()}.tmp`;
    const handle = await fs.promises.open(temporary, 'wx');
    try {
      await handle.writeFile(JSON.stringify(manifest, null, 2), 'utf-8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await fs.promises.rename(temporary, this.metaPath);
    } catch (error) {
      await fs.promises.rm(temporary, { force: true });
      throw error;
    }
  }

  private verifyManifestSignature(manifest: WxUpdateManifest): boolean {
    return this.verifySignature(
      canonicalizeWxUpdateSignature({
        releaseId: manifest.releaseId,
        version: manifest.version,
        sequence: manifest.sequence,
        publishedAt: manifest.publishedAt,
        mandatoryAt: manifest.mandatoryAt,
        minimumVersion: manifest.minimumVersion,
        artifactSize: manifest.artifact.size,
        artifactSha256: manifest.artifact.sha256,
      }),
      manifest.artifact.signature,
    );
  }

  private verifySignature(payload: string, signature: string): boolean {
    if ((process.env.CLIENT_WX_ALLOW_UNSIGNED || '').trim() === '1')
      return true;
    try {
      const base64 = (
        process.env.CLIENT_WX_SIGNATURE_PUBLIC_KEY_DER_BASE64 || ''
      ).trim();
      const pem = (process.env.CLIENT_WX_SIGNATURE_PUBLIC_KEY_PEM || '').trim();
      const pemPath = (
        process.env.CLIENT_WX_SIGNATURE_PUBLIC_KEY_PATH || ''
      ).trim();
      const key = base64
        ? createPublicKey({
            key: Buffer.from(base64, 'base64'),
            format: 'der',
            type: 'spki',
          })
        : createPublicKey(
            pem || (pemPath ? fs.readFileSync(pemPath, 'utf-8') : ''),
          );
      return verifyCryptoSignature(
        'RSA-SHA256',
        Buffer.from(payload, 'utf-8'),
        key,
        Buffer.from(signature, 'base64'),
      );
    } catch {
      return false;
    }
  }

  private requireReleaseId(value: string): string {
    const releaseId = (value || '').trim();
    if (
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(releaseId) ||
      releaseId.includes('..')
    ) {
      throw new BadRequestException('Identifiant de release WX invalide.');
    }
    return releaseId;
  }

  private requireVersion(value: string, message: string): string {
    const version = (value || '').trim();
    if (!parseUpdateVersion(version)) throw new BadRequestException(message);
    return version;
  }

  private requireDate(value: string, message: string): string {
    const date = (value || '').trim();
    if (!date || !Number.isFinite(Date.parse(date))) {
      throw new BadRequestException(message);
    }
    return new Date(date).toISOString();
  }

  private isBase64(value: string): boolean {
    return value.length <= 16_384 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
  }

  private async sha256(filePath: string): Promise<string> {
    const hash = createHash('sha256');
    const stream = fs.createReadStream(filePath);
    for await (const chunk of stream) hash.update(chunk as Buffer);
    return hash.digest('hex');
  }

  private async assertZipHeader(filePath: string): Promise<void> {
    const handle = await fs.promises.open(filePath, 'r');
    try {
      const header = Buffer.alloc(4);
      await handle.read(header, 0, header.length, 0);
      if (header[0] !== 0x50 || header[1] !== 0x4b) {
        throw new BadRequestException('Archive WX invalide.');
      }
    } finally {
      await handle.close();
    }
  }

  private async pathExists(target: string): Promise<boolean> {
    return fs.promises
      .access(target)
      .then(() => true)
      .catch(() => false);
  }

  private isManifest(value: unknown): value is WxUpdateManifest {
    if (!value || typeof value !== 'object') return false;
    const item = value as Partial<WxUpdateManifest>;
    return (
      item.schemaVersion === WX_UPDATE_SCHEMA_VERSION &&
      item.product === WX_UPDATE_PRODUCT &&
      item.platform === WX_UPDATE_PLATFORM &&
      item.architecture === WX_UPDATE_ARCHITECTURE &&
      item.channel === WX_UPDATE_CHANNEL &&
      typeof item.releaseId === 'string' &&
      /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(item.releaseId) &&
      !item.releaseId.includes('..') &&
      typeof item.version === 'string' &&
      parseUpdateVersion(item.version) != null &&
      typeof item.sequence === 'number' &&
      Number.isSafeInteger(item.sequence) &&
      item.sequence > 0 &&
      typeof item.publishedAt === 'string' &&
      Number.isFinite(Date.parse(item.publishedAt)) &&
      (item.mandatoryAt == null ||
        (typeof item.mandatoryAt === 'string' &&
          Number.isFinite(Date.parse(item.mandatoryAt)))) &&
      (item.minimumVersion == null ||
        (typeof item.minimumVersion === 'string' &&
          parseUpdateVersion(item.minimumVersion) != null)) &&
      typeof item.artifact?.url === 'string' &&
      (/^https:\/\//i.test(item.artifact.url) ||
        item.artifact.url.startsWith('/')) &&
      typeof item.artifact?.size === 'number' &&
      Number.isSafeInteger(item.artifact.size) &&
      item.artifact.size > 0 &&
      item.artifact.size <= this.maxArtifactBytes &&
      typeof item.artifact?.sha256 === 'string' &&
      /^[a-f0-9]{64}$/i.test(item.artifact.sha256) &&
      typeof item.artifact?.signature === 'string' &&
      this.isBase64(item.artifact.signature) &&
      item.artifact.signatureAlgorithm === WX_UPDATE_SIGNATURE_ALGORITHM
    );
  }
}
