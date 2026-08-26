import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
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

import type { PublishWxUpdateInput } from './wx-update-publication.model';
export type { PublishWxUpdateInput } from './wx-update-publication.model';
import { WxUpdateArtifactValidatorService } from './wx-update-artifact-validator.service';

type CommitWxPublication = {
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
  installer: { size: number; sha256: string } | null;
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

  constructor(
    private readonly validator: WxUpdateArtifactValidatorService = new WxUpdateArtifactValidatorService(),
  ) {
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
      if (
        this.validator.verifyManifest(
          value as WxUpdateManifest,
          this.maxArtifactBytes,
        )
      ) {
        const manifest = value as WxUpdateManifest;
        this.updateManifestCache(manifest);
        return manifest;
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
      installer: latest.installer
        ? {
            ...latest.installer,
            url: this.resolvePublicUrl(latest.installer.url, origin),
          }
        : undefined,
      currentVersion: current,
      updateAvailable,
      updateRequired,
      mandatory:
        updateRequired || (deadlineReached && updateAvailable === true),
    };
  }

  async publish(input: PublishWxUpdateInput): Promise<WxUpdateManifest> {
    const releaseId = this.validator.requireReleaseId(input.releaseId);
    const version = this.validator.requireVersion(
      input.version,
      'Version WX invalide.',
    );
    const minimumVersion =
      (input.minimumVersion || '').trim() === ''
        ? null
        : this.validator.requireVersion(
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
    const publishedAt = this.validator.requireDate(
      input.publishedAt,
      'Date de publication WX invalide.',
    );
    const mandatoryAt = input.mandatoryAt
      ? this.validator.requireDate(
          input.mandatoryAt,
          'Date obligatoire WX invalide.',
        )
      : null;
    const expectedSha256 = (input.expectedSha256 || '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(expectedSha256)) {
      throw new BadRequestException('SHA-256 WX invalide.');
    }
    const signature = (input.signature || '').trim();
    if (!signature || !this.validator.isBase64(signature)) {
      throw new BadRequestException('Signature WX invalide ou absente.');
    }

    const artifact = await this.validator.validateArtifact(
      { ...input, expectedSha256 },
      this.maxArtifactBytes,
    );
    const installer = await this.validator.validateInstaller(
      input,
      this.maxArtifactBytes,
    );

    return this.commitPublication({
      input,
      releaseId,
      version,
      sequence,
      publishedAt,
      mandatoryAt,
      minimumVersion,
      signature,
      sha256: artifact.sha256,
      artifactSize: artifact.size,
      installer,
    });
  }

  private async commitPublication(
    params: CommitWxPublication,
  ): Promise<WxUpdateManifest> {
    const lock = await this.acquirePublicationLock();
    try {
      const previous = await this.readLatestFromDisk();
      if (
        previous?.releaseId === params.releaseId &&
        previous.sequence === params.sequence &&
        previous.artifact.sha256 === params.sha256
      ) {
        this.updateManifestCache(previous);
        await this.pruneSupersededReleases(previous.releaseId);
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
      if (!this.validator.verifySignature(signaturePayload, params.signature)) {
        throw new BadRequestException('Signature cryptographique WX invalide.');
      }

      const files = await this.prepareReleaseFiles(params);
      const manifest = this.buildManifest(params, files);
      await this.saveLatestAtomically(manifest);
      this.updateManifestCache(manifest);
      await this.pruneSupersededReleases(manifest.releaseId);
      return manifest;
    } finally {
      await lock.close().catch(() => undefined);
      await fs.promises.rm(this.publicationLockPath(), { force: true });
    }
  }

  private async prepareReleaseFiles(params: CommitWxPublication): Promise<{
    fileName: string;
    installerFileName: string;
  }> {
    const releasesDir = path.join(this.updatesDir, 'releases');
    const stagingDir = path.join(this.updatesDir, '.staging', params.releaseId);
    const finalDir = path.join(releasesDir, params.releaseId);
    const fileName = `client-wx-${params.version}-windows-x64.zip`;
    const installerFileName = `LeMondeDeLilaWX-${params.version}-Setup.exe`;
    if (await this.pathExists(finalDir)) {
      const artifactHash = await this.validator
        .sha256(path.join(finalDir, fileName))
        .catch(() => '');
      if (artifactHash !== params.sha256) {
        throw new ConflictException(
          'Cet identifiant de release WX existe avec un autre contenu.',
        );
      }
      await this.ensureExistingInstaller(params, finalDir, installerFileName);
      return { fileName, installerFileName };
    }
    await fs.promises.mkdir(stagingDir, { recursive: true });
    try {
      await fs.promises.copyFile(
        params.input.zipPath,
        path.join(stagingDir, fileName),
      );
      if (params.installer && params.input.installerZipPath) {
        await fs.promises.copyFile(
          params.input.installerZipPath,
          path.join(stagingDir, installerFileName),
        );
      }
      await fs.promises.mkdir(releasesDir, { recursive: true });
      await fs.promises.rename(stagingDir, finalDir);
    } catch (error) {
      await fs.promises.rm(stagingDir, { recursive: true, force: true });
      throw error;
    }
    return { fileName, installerFileName };
  }

  private async ensureExistingInstaller(
    params: CommitWxPublication,
    finalDir: string,
    installerFileName: string,
  ): Promise<void> {
    if (!params.installer) return;
    const installerPath = path.join(finalDir, installerFileName);
    const hash = await this.validator.sha256(installerPath).catch(() => '');
    if (hash && hash !== params.installer.sha256) {
      throw new ConflictException(
        'Cet identifiant de release WX existe avec un autre installateur.',
      );
    }
    if (!hash && params.input.installerZipPath) {
      await fs.promises.copyFile(params.input.installerZipPath, installerPath);
    }
  }

  private buildManifest(
    params: CommitWxPublication,
    files: { fileName: string; installerFileName: string },
  ): WxUpdateManifest {
    const baseUrl = `${this.publicUrl.replace(/\/$/, '')}/releases/${encodeURIComponent(params.releaseId)}`;
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
        url: `${baseUrl}/${encodeURIComponent(files.fileName)}`,
        size: params.artifactSize,
        sha256: params.sha256,
        signature: params.signature,
        signatureAlgorithm: WX_UPDATE_SIGNATURE_ALGORITHM,
      },
    };
    if (params.installer) {
      manifest.installer = {
        url: `${baseUrl}/${encodeURIComponent(files.installerFileName)}`,
        size: params.installer.size,
        sha256: params.installer.sha256,
      };
    }
    return manifest;
  }

  private async pruneSupersededReleases(
    activeReleaseId: string,
  ): Promise<void> {
    const releasesDir = path.join(this.updatesDir, 'releases');
    const entries = await fs.promises.readdir(releasesDir, {
      withFileTypes: true,
    });
    await Promise.all(
      entries
        .filter((entry) => entry.name !== activeReleaseId)
        .map((entry) =>
          fs.promises.rm(path.join(releasesDir, entry.name), {
            recursive: true,
            force: true,
          }),
        ),
    );
    await fs.promises.rm(path.join(this.updatesDir, '.staging'), {
      recursive: true,
      force: true,
    });
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
      return this.validator.verifyManifest(
        value as WxUpdateManifest,
        this.maxArtifactBytes,
      )
        ? (value as WxUpdateManifest)
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

  private async pathExists(target: string): Promise<boolean> {
    return fs.promises
      .access(target)
      .then(() => true)
      .catch(() => false);
  }
}
