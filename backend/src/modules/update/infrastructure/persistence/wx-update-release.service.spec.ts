import { createHash, generateKeyPairSync, sign } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { canonicalizeWxUpdateSignature } from '../../domain/wx-update-manifest';
import { WxUpdateArtifactValidatorService } from './wx-update-artifact-validator.service';
import { WxUpdateReleaseService } from './wx-update-release.service';

function validZipPayload(label: string): Buffer {
  const name = Buffer.from('payload.txt');
  const body = Buffer.from(label);
  const local = Buffer.alloc(30 + name.length + body.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt32LE(body.length, 18);
  name.copy(local, 30);
  body.copy(local, 30 + name.length);
  const central = Buffer.alloc(46 + name.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(body.length, 20);
  central.writeUInt32LE(body.length, 24);
  name.copy(central, 46);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(local.length, 16);
  return Buffer.concat([local, central, eocd]);
}

function validPePayload(machine = 0x8664): Buffer {
  const value = Buffer.alloc(512);
  value.writeUInt16LE(0x5a4d, 0);
  value.writeUInt32LE(0x80, 0x3c);
  value.writeUInt32LE(0x00004550, 0x80);
  value.writeUInt16LE(machine, 0x84);
  value.writeUInt16LE(1, 0x86);
  return value;
}

describe('WxUpdateReleaseService', () => {
  let root: string;
  let releases: WxUpdateReleaseService;
  let now: number;
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
    now = Date.parse('2026-09-09T00:00:00Z');
    releases = new WxUpdateReleaseService(undefined, { now: () => now });
  });

  afterEach(async () => {
    delete process.env.CLIENT_WX_UPDATES_DIR;
    delete process.env.CLIENT_WX_UPDATES_META_PATH;
    delete process.env.CLIENT_WX_UPDATES_PUBLIC_URL;
    delete process.env.CLIENT_WX_SIGNATURE_PUBLIC_KEY_DER_BASE64;
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  it('rejects files that only spoof ZIP or PE magic bytes', async () => {
    const validator = new WxUpdateArtifactValidatorService();
    const fakeZip = path.join(root, 'fake.zip');
    const fakePe = path.join(root, 'fake.exe');
    await fs.promises.writeFile(fakeZip, Buffer.from('PK\x03\x04not-a-zip'));
    await fs.promises.writeFile(fakePe, Buffer.from('MZnot-a-pe'));
    await expect(
      validator.validateArtifact(
        {
          zipPath: fakeZip,
          expectedSha256: createHash('sha256')
            .update('PK\x03\x04not-a-zip')
            .digest('hex'),
        } as never,
        1024,
      ),
    ).rejects.toThrow('Archive WX invalide');
    await expect(
      validator.validateInstaller({ installerZipPath: fakePe } as never, 1024),
    ).rejects.toThrow('Installateur WX invalide');
  });

  const publishRelease = async (input: {
    releaseId: string;
    version: string;
    sequence: number;
    content: Buffer;
    installerZipPath?: string;
    mandatoryAt?: string;
  }) => {
    const archive = path.join(root, `${input.releaseId}.zip`);
    await fs.promises.writeFile(archive, input.content);
    const sha256 = createHash('sha256').update(input.content).digest('hex');
    const installerContent = input.installerZipPath
      ? await fs.promises.readFile(input.installerZipPath)
      : null;
    const installerSha256 = installerContent
      ? createHash('sha256').update(installerContent).digest('hex')
      : null;
    const fields = {
      releaseId: input.releaseId,
      version: input.version,
      sequence: input.sequence,
      publishedAt: '2026-08-24T12:00:00.000Z',
      mandatoryAt: input.mandatoryAt ?? null,
      minimumVersion: null,
      artifactSize: input.content.length,
      artifactSha256: sha256,
      installerSha256,
    };
    const signature = sign(
      'RSA-SHA256',
      Buffer.from(canonicalizeWxUpdateSignature(fields)),
      privateKey,
    ).toString('base64');
    return releases.publish({
      zipPath: archive,
      ...fields,
      expectedSha256: sha256,
      expectedInstallerSha256: installerSha256 ?? undefined,
      signature,
      installerZipPath: input.installerZipPath,
    });
  };

  it('applies a signed mandatory deadline using the injected clock', async () => {
    const deadline = now + 1000;
    await publishRelease({
      releaseId: 'deadline',
      version: '1.4.2',
      sequence: 1,
      content: validZipPayload('archive'),
      mandatoryAt: new Date(deadline).toISOString(),
    });
    expect((await releases.getForClient('1.4.1', null))?.mandatory).toBe(false);
    now = deadline;
    expect((await releases.getForClient('1.4.1', null))?.mandatory).toBe(true);
  });

  it('refuses a competing publication before creating a manifest', async () => {
    const acquire = jest.fn().mockResolvedValue(null);
    releases = new WxUpdateReleaseService(undefined, { now: () => now }, {
      acquire,
    } as never);
    await expect(
      publishRelease({
        releaseId: 'busy',
        version: '1.0.0',
        sequence: 1,
        content: validZipPayload('busy'),
      }),
    ).rejects.toThrow('déjà en cours');
    expect(acquire).toHaveBeenCalledWith('lemonde:update:publication', 900000);
    expect(fs.existsSync(path.join(root, 'latest.json'))).toBe(false);
  });

  it('does not publish a manifest if the distributed lease is lost while preparing files', async () => {
    const lease = {
      isHeld: jest.fn().mockResolvedValueOnce(true).mockResolvedValue(false),
      release: jest.fn().mockResolvedValue(undefined),
    };
    releases = new WxUpdateReleaseService(undefined, { now: () => now }, {
      acquire: async () => lease,
    } as never);
    await expect(
      publishRelease({
        releaseId: 'lost',
        version: '1.0.0',
        sequence: 1,
        content: validZipPayload('lost'),
      }),
    ).rejects.toThrow('Bail');
    expect(fs.existsSync(path.join(root, 'latest.json'))).toBe(false);
    expect(lease.release).toHaveBeenCalledTimes(1);
  });

  it('releases the distributed lease after a successful publication', async () => {
    const lease = {
      isHeld: jest.fn().mockResolvedValue(true),
      release: jest.fn().mockResolvedValue(undefined),
    };
    releases = new WxUpdateReleaseService(undefined, { now: () => now }, {
      acquire: async () => lease,
    } as never);
    await publishRelease({
      releaseId: 'held',
      version: '1.0.0',
      sequence: 1,
      content: validZipPayload('held'),
    });
    expect(fs.existsSync(path.join(root, 'latest.json'))).toBe(true);
    expect(lease.release).toHaveBeenCalledTimes(1);
  });

  it('never exposes a partial installer when completing an existing release directory', async () => {
    const releaseId = 'interrupted-release';
    const content = validZipPayload('archive');
    const finalDir = path.join(root, 'artifacts', 'releases', releaseId);
    await fs.promises.mkdir(finalDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(finalDir, 'client-wx-1.4.2-windows-x64.zip'),
      content,
    );
    const installerZipPath = path.join(root, 'installer.exe');
    await fs.promises.writeFile(installerZipPath, validPePayload());
    const copy = jest
      .spyOn(fs.promises, 'copyFile')
      .mockImplementationOnce(async (_source, destination) => {
        await fs.promises.writeFile(destination, 'partial');
        throw new Error('interrupted copy');
      });
    try {
      await expect(
        publishRelease({
          releaseId,
          version: '1.4.2',
          sequence: 1,
          content,
          installerZipPath,
        }),
      ).rejects.toThrow('interrupted copy');
      await expect(
        fs.promises.stat(
          path.join(finalDir, 'LeMondeDeLilaWX-1.4.2-Setup.exe'),
        ),
      ).rejects.toMatchObject({ code: 'ENOENT' });
      expect(await releases.getLatest()).toBeNull();
      expect(
        await fs.promises.readdir(path.join(root, 'artifacts', '.staging')),
      ).toEqual([]);
    } finally {
      copy.mockRestore();
    }
    const manifest = await publishRelease({
      releaseId,
      version: '1.4.2',
      sequence: 1,
      content,
      installerZipPath,
    });
    expect(manifest.installer).toBeDefined();
    expect(
      await fs.promises.readFile(
        path.join(finalDir, 'LeMondeDeLilaWX-1.4.2-Setup.exe'),
        'utf8',
      ),
    ).toHaveLength(512);
  });

  it('rejects an installer missing its DOS signature', async () => {
    const installer = validPePayload();
    installer.writeUInt16LE(0, 0);
    const installerZipPath = path.join(root, 'missing-dos.exe');
    await fs.promises.writeFile(installerZipPath, installer);
    await expect(
      publishRelease({
        releaseId: 'missing-dos',
        version: '1.0.0',
        sequence: 1,
        content: validZipPayload('client'),
        installerZipPath,
      }),
    ).rejects.toThrow('Installateur WX invalide');
    expect(await releases.getLatest()).toBeNull();
  });

  it('accepts the PE32 i386 bootstrap generated by NSIS for an x64 payload', async () => {
    const installerZipPath = path.join(root, 'nsis-bootstrap.exe');
    await fs.promises.writeFile(installerZipPath, validPePayload(0x014c));
    const manifest = await publishRelease({
      releaseId: 'nsis-bootstrap',
      version: '1.0.0',
      sequence: 1,
      content: validZipPayload('client'),
      installerZipPath,
    });
    expect(manifest.installer?.size).toBe(512);
  });

  it('reads a bounded PE header at its declared offset beyond the DOS stub', async () => {
    const installer = Buffer.alloc(1024);
    installer.writeUInt16LE(0x5a4d, 0);
    installer.writeUInt32LE(0x200, 0x3c);
    installer.writeUInt32LE(0x00004550, 0x200);
    installer.writeUInt16LE(0x8664, 0x204);
    installer.writeUInt16LE(1, 0x206);
    const installerZipPath = path.join(root, 'large-stub.exe');
    await fs.promises.writeFile(installerZipPath, installer);
    const manifest = await publishRelease({
      releaseId: 'large-stub',
      version: '1.0.0',
      sequence: 1,
      content: validZipPayload('client'),
      installerZipPath,
    });
    expect(manifest.installer?.size).toBe(1024);
  });

  it('rejects bytes changed between validation and staging without replacing the manifest', async () => {
    await publishRelease({
      releaseId: 'trusted',
      version: '1.0.0',
      sequence: 1,
      content: validZipPayload('trusted'),
    });
    const copy = jest
      .spyOn(fs.promises, 'copyFile')
      .mockImplementationOnce(async (_source, destination) => {
        await fs.promises.writeFile(destination, validZipPayload('modified'));
      });
    try {
      await expect(
        publishRelease({
          releaseId: 'changed',
          version: '1.0.1',
          sequence: 2,
          content: validZipPayload('original'),
        }),
      ).rejects.toThrow('changé pendant la publication');
      expect((await releases.getLatest())?.releaseId).toBe('trusted');
      expect(
        fs.existsSync(path.join(root, 'artifacts', 'releases', 'changed')),
      ).toBe(false);
    } finally {
      copy.mockRestore();
    }
  });

  it('publishes an immutable, signed manifest and enforces the minimum version', async () => {
    const archive = path.join(root, 'client.zip');
    const installer = path.join(root, 'installer.zip');
    const content = validZipPayload('signed-test-archive');
    const installerContent = validPePayload();
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
      installerSha256: installerSha256,
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
        `installerSha256=${installerSha256}`,
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
    const validator = new WxUpdateArtifactValidatorService();
    expect(validator.verifyManifest(manifest, 2048)).toBe(true);
    for (const tampered of [
      { ...manifest, sequence: manifest.sequence + 1 },
      { ...manifest, minimumVersion: '9.9.9' },
      {
        ...manifest,
        artifact: { ...manifest.artifact, sha256: '0'.repeat(64) },
      },
      {
        ...manifest,
        installer: { ...manifest.installer, sha256: '0'.repeat(64) },
      },
    ]) {
      expect(validator.verifyManifest(tampered, 2048)).toBe(false);
    }
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
    await fs.promises.writeFile(archive, validZipPayload('archive'));
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

  it('preserves previously issued artifact URLs across publication and retries', async () => {
    const releasesDir = path.join(root, 'artifacts', 'releases');
    await publishRelease({
      releaseId: '1.4.1-release-old',
      version: '1.4.1',
      sequence: 1,
      content: validZipPayload('old-release'),
    });
    const oldPath = path.join(
      releasesDir,
      '1.4.1-release-old',
      'client-wx-1.4.1-windows-x64.zip',
    );

    const latestInput = {
      releaseId: '1.4.2-release-latest',
      version: '1.4.2',
      sequence: 2,
      content: validZipPayload('latest-release'),
    };
    await publishRelease(latestInput);

    expect((await fs.promises.readdir(releasesDir)).sort()).toEqual([
      '1.4.1-release-old',
      latestInput.releaseId,
    ]);
    const staging = path.join(root, 'artifacts', '.staging');
    await fs.promises.mkdir(staging, { recursive: true });
    await fs.promises.writeFile(
      path.join(staging, 'interrupted.tmp'),
      'partial',
    );

    await publishRelease(latestInput);

    expect((await fs.promises.readdir(releasesDir)).sort()).toEqual([
      '1.4.1-release-old',
      latestInput.releaseId,
    ]);
    expect(await fs.promises.readFile(oldPath)).toEqual(
      validZipPayload('old-release'),
    );
    expect(fs.existsSync(staging)).toBe(false);
    expect((await releases.getLatest())?.releaseId).toBe(latestInput.releaseId);
  });
});
