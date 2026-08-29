import { BadRequestException, ConflictException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  bestEffort,
  writeFileAtomic,
} from '../../../../shared/utils/public-api';
import {
  canonicalizeWxUpdateSignature,
  WX_UPDATE_ARCHITECTURE,
  WX_UPDATE_CHANNEL,
  WX_UPDATE_PLATFORM,
  WX_UPDATE_PRODUCT,
  WX_UPDATE_SCHEMA_VERSION,
  WX_UPDATE_SIGNATURE_ALGORITHM,
  type WxUpdateManifest,
} from '../../domain/wx-update-manifest';
import type { PublishWxUpdateInput } from './wx-update-publication.model';
import type { WxUpdateArtifactValidatorService } from './wx-update-artifact-validator.service';

export type WxPublicationCommit = {
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

export class WxUpdatePublicationManager {
  constructor(
    private readonly updatesDir: string,
    private readonly metaPath: string,
    private readonly publicUrl: string,
    private readonly maxArtifactBytes: number,
    private readonly validator: WxUpdateArtifactValidatorService,
    private readonly updateCache: (manifest: WxUpdateManifest) => void,
  ) {}

  async commit(params: WxPublicationCommit): Promise<WxUpdateManifest> {
    const lock = await this.acquirePublicationLock();
    try {
      const previous = await this.readLatestFromDisk();
      if (
        previous?.releaseId === params.releaseId &&
        previous.sequence === params.sequence &&
        previous.artifact.sha256 === params.sha256
      ) {
        this.updateCache(previous);
        await this.pruneSupersededReleases(previous.releaseId);
        return previous;
      }
      if (previous && params.sequence <= previous.sequence) {
        throw new ConflictException(
          `La séquence WX doit être supérieure à ${previous.sequence}.`,
        );
      }
      this.assertSignature(params);
      const files = await this.prepareReleaseFiles(params);
      const manifest = this.buildManifest(params, files);
      await writeFileAtomic(this.metaPath, JSON.stringify(manifest, null, 2));
      this.updateCache(manifest);
      await this.pruneSupersededReleases(manifest.releaseId);
      return manifest;
    } finally {
      await bestEffort(lock.close(), 'fermeture du verrou de publication WX');
      await fs.promises.rm(this.publicationLockPath(), { force: true });
    }
  }

  private assertSignature(params: WxPublicationCommit): void {
    const payload = canonicalizeWxUpdateSignature({
      releaseId: params.releaseId,
      version: params.version,
      sequence: params.sequence,
      publishedAt: params.publishedAt,
      mandatoryAt: params.mandatoryAt,
      minimumVersion: params.minimumVersion,
      artifactSize: params.artifactSize,
      artifactSha256: params.sha256,
    });
    if (!this.validator.verifySignature(payload, params.signature)) {
      throw new BadRequestException('Signature cryptographique WX invalide.');
    }
  }

  private async prepareReleaseFiles(params: WxPublicationCommit): Promise<{
    fileName: string;
    installerFileName: string;
  }> {
    const releasesDir = path.join(this.updatesDir, 'releases');
    const stagingDir = path.join(this.updatesDir, '.staging', params.releaseId);
    const finalDir = path.join(releasesDir, params.releaseId);
    const fileName = `client-wx-${params.version}-windows-x64.zip`;
    const installerFileName = `LeMondeDeLilaWX-${params.version}-Setup.exe`;
    if (await pathExists(finalDir)) {
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
    params: WxPublicationCommit,
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
    params: WxPublicationCommit,
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
}

function pathExists(target: string): Promise<boolean> {
  return fs.promises
    .access(target)
    .then(() => true)
    .catch(() => false);
}
