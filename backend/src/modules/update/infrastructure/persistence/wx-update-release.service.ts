import { BadRequestException, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { readEnvironment } from '../../../../platform/config/public-api';
import {
  compareUpdateVersions,
  parseUpdateVersion,
} from '../../domain/update-version';
import type {
  WxUpdateManifest,
  WxUpdateManifestResponse,
} from '../../domain/wx-update-manifest';
import type { PublishWxUpdateInput } from './wx-update-publication.model';
export type { PublishWxUpdateInput } from './wx-update-publication.model';
import { WxUpdateArtifactValidatorService } from './wx-update-artifact-validator.service';
import { WxUpdatePublicationManager } from './wx-update-publication.manager';

@Injectable()
export class WxUpdateReleaseService {
  private static readonly manifestCacheTtlMs = 5_000;
  private static readonly defaultMaxArtifactBytes = 2 * 1024 * 1024 * 1024;

  private readonly updatesDir: string;
  private readonly metaPath: string;
  private readonly publicUrl: string;
  private readonly maxArtifactBytes: number;
  private readonly publication: WxUpdatePublicationManager;
  private cachedManifest: WxUpdateManifest | null = null;
  private manifestCacheInitialized = false;
  private manifestCacheExpiresAt = 0;

  constructor(
    private readonly validator: WxUpdateArtifactValidatorService = new WxUpdateArtifactValidatorService(),
  ) {
    const backendRoot = path.resolve(__dirname, '..', '..', '..', '..');
    const dataRoot = path.join(backendRoot, 'data', 'client-wx-updates');
    this.updatesDir =
      readEnvironment('CLIENT_WX_UPDATES_DIR').trim() ||
      path.join(dataRoot, 'client-wx');
    this.metaPath =
      readEnvironment('CLIENT_WX_UPDATES_META_PATH').trim() ||
      path.join(dataRoot, 'client-wx-latest.json');
    this.publicUrl =
      readEnvironment('CLIENT_WX_UPDATES_PUBLIC_URL').trim() ||
      '/updates/client-wx';
    const configuredMax = Number(
      readEnvironment('CLIENT_WX_MAX_ARTIFACT_BYTES'),
    );
    this.maxArtifactBytes =
      Number.isSafeInteger(configuredMax) && configuredMax > 0
        ? configuredMax
        : WxUpdateReleaseService.defaultMaxArtifactBytes;
    this.publication = new WxUpdatePublicationManager(
      this.updatesDir,
      this.metaPath,
      this.publicUrl,
      this.maxArtifactBytes,
      validator,
      (manifest) => this.updateManifestCache(manifest),
    );
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
      const value: unknown = JSON.parse(raw.replace(/^\uFEFF/, ''));
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
    const explicit = readEnvironment('CLIENT_WX_MIN_VERSION').trim();
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
        url: resolvePublicUrl(latest.artifact.url, origin),
      },
      installer: latest.installer
        ? {
            ...latest.installer,
            url: resolvePublicUrl(latest.installer.url, origin),
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
    const minimumVersion = this.resolveMinimumVersion(input, version);
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
    return this.publication.commit({
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

  private resolveMinimumVersion(
    input: PublishWxUpdateInput,
    version: string,
  ): string | null {
    const value = input.minimumVersion?.trim() ?? '';
    const minimum = value
      ? this.validator.requireVersion(value, 'Version minimale WX invalide.')
      : null;
    if (minimum && (compareUpdateVersions(minimum, version) ?? 1) > 0) {
      throw new BadRequestException(
        'La version minimale WX dépasse la version publiée.',
      );
    }
    return minimum;
  }

  private updateManifestCache(manifest: WxUpdateManifest): void {
    this.cachedManifest = manifest;
    this.manifestCacheInitialized = true;
    this.manifestCacheExpiresAt =
      Date.now() + WxUpdateReleaseService.manifestCacheTtlMs;
  }
}

function resolvePublicUrl(value: string, origin: string | null): string {
  if (/^https:\/\//i.test(value)) return value;
  if (origin && value.startsWith('/')) {
    return `${origin.replace(/\/$/, '')}${value}`;
  }
  return value;
}
