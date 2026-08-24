import { createHash, generateKeyPairSync, sign } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { canonicalizeWxUpdateSignature } from '../../domain/wx-update-manifest';
import { WxUpdateReleaseService } from './wx-update-release.service';

describe('WxUpdateReleaseService', () => {
  let root: string;
  let releases: WxUpdateReleaseService;
  let privateKey: ReturnType<typeof generateKeyPairSync>['privateKey'];

  beforeEach(async () => {
    root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'lila-wx-update-'));
    const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
    privateKey = keys.privateKey;
    process.env.CLIENT_WX_UPDATES_DIR = path.join(root, 'artifacts');
    process.env.CLIENT_WX_UPDATES_META_PATH = path.join(root, 'latest.json');
    process.env.CLIENT_WX_UPDATES_PUBLIC_URL = '/updates/client-wx';
    process.env.CLIENT_WX_SIGNATURE_PUBLIC_KEY_DER_BASE64 = keys.publicKey
      .export({ type: 'spki', format: 'der' })
      .toString('base64');
    delete process.env.CLIENT_WX_ALLOW_UNSIGNED;
    releases = new WxUpdateReleaseService();
  });

  afterEach(async () => {
    delete process.env.CLIENT_WX_UPDATES_DIR;
    delete process.env.CLIENT_WX_UPDATES_META_PATH;
    delete process.env.CLIENT_WX_UPDATES_PUBLIC_URL;
    delete process.env.CLIENT_WX_SIGNATURE_PUBLIC_KEY_DER_BASE64;
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  it('publishes an immutable, signed manifest and enforces the minimum version', async () => {
    const archive = path.join(root, 'client.zip');
    const installer = path.join(root, 'installer.zip');
    const content = Buffer.from('PK\x03\x04signed-test-archive');
    const installerContent = Buffer.from('MZinstaller-test-archive');
    await fs.promises.writeFile(archive, content);
    await fs.promises.writeFile(installer, installerContent);
    const sha256 = createHash('sha256').update(content).digest('hex');
    const installerSha256 = createHash('sha256')
      .update(installerContent)
      .digest('hex');
    const fields = {
      releaseId: '1.4.2-release-abc',
      version: '1.4.2',
      sequence: 1_724_500_000_001,
      publishedAt: '2026-08-24T12:00:00.000Z',
      mandatoryAt: '2026-08-24T12:00:00.000Z',
      minimumVersion: '1.4.2',
      artifactSize: content.length,
      artifactSha256: sha256,
    };
    expect(canonicalizeWxUpdateSignature(fields)).toBe(
      [
        'lila-client-wx-manifest-v2',
        'product=client-wx',
        'platform=windows',
        'architecture=x64',
        'channel=stable',
        'releaseId=1.4.2-release-abc',
        'version=1.4.2',
        'sequence=1724500000001',
        'publishedAt=2026-08-24T12:00:00.000Z',
        'mandatoryAt=2026-08-24T12:00:00.000Z',
        'minimumVersion=1.4.2',
        `artifactSize=${content.length}`,
        `artifactSha256=${sha256}`,
      ].join('\n'),
    );
    const signature = sign(
      'RSA-SHA256',
      Buffer.from(canonicalizeWxUpdateSignature(fields)),
      privateKey,
    ).toString('base64');

    const manifest = await releases.publish({
      zipPath: archive,
      installerZipPath: installer,
      ...fields,
      expectedSha256: sha256,
      expectedInstallerSha256: installerSha256,
      signature,
    });

    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.artifact.sha256).toBe(sha256);
    expect(manifest.artifact.url).toContain(
      '/releases/1.4.2-release-abc/client-wx-1.4.2-windows-x64.zip',
    );
    expect(manifest.installer?.sha256).toBe(installerSha256);
    expect(manifest.installer?.url).toContain(
      '/releases/1.4.2-release-abc/LeMondeDeLilaWX-1.4.2-Setup.exe',
    );
    expect(await releases.getMinimumVersion()).toBe('1.4.2');
    const clientManifest = await releases.getForClient(
      '1.3.0',
      'https://api.lilas.hociatec.fr',
    );
    expect(clientManifest?.mandatory).toBe(true);
    expect(clientManifest?.installer?.url).toBe(
      'https://api.lilas.hociatec.fr/updates/client-wx/releases/1.4.2-release-abc/LeMondeDeLilaWX-1.4.2-Setup.exe',
    );
  });

  it('rejects traversal release identifiers before touching the release tree', async () => {
    const archive = path.join(root, 'client.zip');
    await fs.promises.writeFile(archive, Buffer.from('PK\x03\x04archive'));
    await expect(
      releases.publish({
        zipPath: archive,
        releaseId: '../outside',
        version: '1.4.2',
        sequence: 1,
        publishedAt: '2026-08-24T12:00:00.000Z',
        minimumVersion: null,
        mandatoryAt: null,
        expectedSha256: '0'.repeat(64),
        signature: 'AA==',
      }),
    ).rejects.toThrow('Identifiant de release WX invalide');
  });
});
