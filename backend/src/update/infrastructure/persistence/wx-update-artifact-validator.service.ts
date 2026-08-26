import { BadRequestException, Injectable } from '@nestjs/common';
import {
  createHash,
  createPublicKey,
  verify as verifyCryptoSignature,
} from 'crypto';
import * as fs from 'fs';
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
import { parseUpdateVersion } from '../../domain/update-version';
import type {
  PublishWxUpdateInput,
  ValidatedWxArtifact,
} from './wx-update-publication.model';

@Injectable()
export class WxUpdateArtifactValidatorService {
  async validateArtifact(
    input: PublishWxUpdateInput,
    maxBytes: number,
  ): Promise<ValidatedWxArtifact> {
    const stat = await fs.promises.stat(input.zipPath).catch(() => null);
    if (!stat?.isFile() || stat.size <= 0 || stat.size > maxBytes) {
      throw new BadRequestException(
        'Archive WX absente, vide ou trop volumineuse.',
      );
    }
    await this.assertHeader(
      input.zipPath,
      [0x50, 0x4b],
      'Archive WX invalide.',
    );
    const sha256 = await this.sha256(input.zipPath);
    if ((input.expectedSha256 || '').trim().toLowerCase() !== sha256) {
      throw new BadRequestException(
        "Empreinte SHA-256 de l'archive WX invalide.",
      );
    }
    return { size: stat.size, sha256 };
  }

  async validateInstaller(
    input: PublishWxUpdateInput,
    maxBytes: number,
  ): Promise<ValidatedWxArtifact | null> {
    const installerPath = (input.installerZipPath || '').trim();
    if (!installerPath) return null;
    const stat = await fs.promises.stat(installerPath).catch(() => null);
    if (!stat?.isFile() || stat.size <= 0 || stat.size > maxBytes) {
      throw new BadRequestException(
        'Installateur WX absent, vide ou trop volumineux.',
      );
    }
    await this.assertHeader(
      installerPath,
      [0x4d, 0x5a],
      'Installateur WX invalide.',
    );
    const sha256 = await this.sha256(installerPath);
    const expected = (input.expectedInstallerSha256 || '').trim().toLowerCase();
    if (expected && expected !== sha256) {
      throw new BadRequestException(
        "Empreinte SHA-256 de l'installateur WX invalide.",
      );
    }
    return { size: stat.size, sha256 };
  }

  verifyManifest(manifest: WxUpdateManifest, maxBytes: number): boolean {
    if (!this.isManifest(manifest, maxBytes)) return false;
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

  verifySignature(payload: string, signature: string): boolean {
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

  requireReleaseId(value: string): string {
    const releaseId = (value || '').trim();
    if (
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(releaseId) ||
      releaseId.includes('..')
    ) {
      throw new BadRequestException('Identifiant de release WX invalide.');
    }
    return releaseId;
  }

  requireVersion(value: string, message: string): string {
    const version = (value || '').trim();
    if (!parseUpdateVersion(version)) throw new BadRequestException(message);
    return version;
  }

  requireDate(value: string, message: string): string {
    const date = (value || '').trim();
    if (!date || !Number.isFinite(Date.parse(date))) {
      throw new BadRequestException(message);
    }
    return new Date(date).toISOString();
  }

  isBase64(value: string): boolean {
    return value.length <= 16_384 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
  }

  async sha256(filePath: string): Promise<string> {
    const hash = createHash('sha256');
    const stream = fs.createReadStream(filePath);
    for await (const chunk of stream) hash.update(chunk as Buffer);
    return hash.digest('hex');
  }

  private async assertHeader(
    filePath: string,
    expected: number[],
    message: string,
  ): Promise<void> {
    const handle = await fs.promises.open(filePath, 'r');
    try {
      const header = Buffer.alloc(expected.length);
      await handle.read(header, 0, header.length, 0);
      if (expected.some((value, index) => header[index] !== value)) {
        throw new BadRequestException(message);
      }
    } finally {
      await handle.close();
    }
  }

  private isManifest(
    value: unknown,
    maxBytes: number,
  ): value is WxUpdateManifest {
    if (!value || typeof value !== 'object') return false;
    const item = value as Partial<WxUpdateManifest>;
    const artifact = item.artifact;
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
        Number.isFinite(Date.parse(item.mandatoryAt))) &&
      (item.minimumVersion == null ||
        parseUpdateVersion(item.minimumVersion) != null) &&
      typeof artifact?.url === 'string' &&
      (/^https:\/\//i.test(artifact.url) || artifact.url.startsWith('/')) &&
      typeof artifact.size === 'number' &&
      Number.isSafeInteger(artifact.size) &&
      artifact.size > 0 &&
      artifact.size <= maxBytes &&
      typeof artifact.sha256 === 'string' &&
      /^[a-f0-9]{64}$/i.test(artifact.sha256) &&
      typeof artifact.signature === 'string' &&
      this.isBase64(artifact.signature) &&
      artifact.signatureAlgorithm === WX_UPDATE_SIGNATURE_ALGORITHM &&
      this.isInstallerValid(item.installer, maxBytes)
    );
  }

  private isInstallerValid(
    value: WxUpdateManifest['installer'] | undefined,
    maxBytes: number,
  ): boolean {
    if (value == null) return true;
    return (
      typeof value.url === 'string' &&
      (/^https:\/\//i.test(value.url) || value.url.startsWith('/')) &&
      Number.isSafeInteger(value.size) &&
      value.size > 0 &&
      value.size <= maxBytes &&
      /^[a-f0-9]{64}$/i.test(value.sha256)
    );
  }
}
