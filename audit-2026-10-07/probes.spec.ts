// Audit probes: passing means the unwanted behavior was reproduced.
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateKeyPairSync } from 'crypto';
import { sign } from '../backend/node_modules/jsonwebtoken';
import { remapVaultGameState } from '../backend/src/modules/vault/application/services/vault-game-state-remapper';
import { PrivateMessagingService } from '../backend/src/modules/messaging/application/services/private-messaging.service';
import { MessageValidatorService } from '../backend/src/modules/messaging/application/services/message-validator.service';
import { SoundsUploadManager } from '../backend/src/modules/sounds/infrastructure/storage/sounds-upload.manager';
import { SoundsTableAmbiencesManager } from '../backend/src/modules/sounds/infrastructure/storage/sounds-table-ambiences.manager';
import { removeUnusedFilesForSoundId } from '../backend/src/modules/sounds/infrastructure/storage/sounds-storage-maintenance';
import { WxUpdatePublicationManager } from '../backend/src/modules/update/infrastructure/persistence/wx-update-publication.manager';
import { RefreshUserSessionService } from '../backend/src/modules/user/application/use-cases/refresh-user-session.service';
import { HttpJwtGuard } from '../backend/src/platform/auth/infrastructure/presentation/http/http-jwt.guard';
import { AdminRoleGuard } from '../backend/src/platform/auth/infrastructure/presentation/http/admin-role.guard';
import { JwtPayloadVerifierService } from '../backend/src/platform/auth/application/services/jwt-payload-verifier.service';

jest.mock('../backend/src/modules/sounds/infrastructure/storage/sounds-audio.utils', () => ({
  probeSoundDurationSeconds: jest.fn().mockResolvedValue(1),
  detectSoundSilence: jest.fn().mockResolvedValue(false),
  transcodeSoundToStableWav: jest.fn(async (input: string) => ({ outputPath: input, tempDir: null })),
}));

function barrier(count: number) {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => { release = resolve; });
  return async () => { if (--count === 0) release(); await wait; };
}

describe('Audit 2026-10-07 - isolated defect reproductions', () => {
  let root: string;
  beforeEach(async () => { root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'lila-audit-')); });
  afterEach(async () => {
    if (!path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep)) throw new Error('Unsafe cleanup');
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  test('Vault remaps a board position as if it were a bot ID', () => {
    const result = remapVaultGameState({ status: 'started', players: [{ id: -1 }],
      kits: { movement: { positions: { track: { '42': -1 } } } } }, {
      roomId: 10, roomOwnerId: 42, roomStartedAt: null, roomRunId: null,
      botIdMap: new Map([[-1, -99]]), botNamesByNewId: new Map(),
    });
    expect((result.kits as any).movement.positions.track['42']).toBe(-99);
  });

  test('Vault applies the bot mapping twice to players and current turn', () => {
    const result = remapVaultGameState({ status: 'started', players: [{ id: -1 }, { id: -2 }],
      turn: { currentPlayerId: -1 } }, {
      roomId: 10, roomOwnerId: 42, roomStartedAt: null, roomRunId: null,
      botIdMap: new Map([[-1, -2], [-2, -3]]), botNamesByNewId: new Map(),
    });
    expect(result.players?.map((p) => p.id)).toEqual([-3, -3]);
    expect(result.turn?.currentPlayerId).toBe(-3);
  });

  test('sender can purge a message still present in recipient inbox', async () => {
    const row: any = { id: 1, messageId: 'audit', sender: { id: 1 }, recipient: { id: 2 },
      deletedBySenderAt: new Date(), deletedByRecipientAt: null, readByRecipientAt: null };
    const messages = { findByMessageId: jest.fn().mockResolvedValue(row), remove: jest.fn() };
    const service = new PrivateMessagingService(messages as any, {} as any, new MessageValidatorService(), { now: Date.now });
    await service.purge(1, 'audit');
    expect(messages.remove).toHaveBeenCalledWith('audit');
    expect(row.deletedByRecipientAt).toBeNull();
  });

  async function concurrentUploads(sameId: boolean) {
    let manifest: any = { updatedAt: '', sounds: {}, disabled: [] };
    const bothRead = barrier(2);
    const bothPersisted = barrier(2);
    const upload = new SoundsUploadManager({
      dataRoot: root, normalizeSoundKey: (id) => id as any,
      readManifest: async () => { const snapshot = structuredClone(manifest); await bothRead(); return snapshot; },
      writeManifest: async (next) => { manifest = next; },
      removeUnusedFiles: async (id, hash) => {
        await bothPersisted();
        return removeUnusedFilesForSoundId(root, () => {}, id, hash, { strict: true });
      },
      notifyUpdated: async () => {}, storageError: (_, error) => error as Error,
      ensureStorageCapacity: async () => {}, warn: () => {},
    });
    const a = path.join(root, 'a.wav'), b = path.join(root, 'b.wav');
    await fs.promises.writeFile(a, 'sound A');
    await fs.promises.writeFile(b, 'sound B');
    await Promise.all([
      upload.setSound('TableAmbience1', a, 'a.wav', 'audio/wav'),
      upload.setSound(sameId ? 'TableAmbience1' : 'TableAmbience2', b, 'b.wav', 'audio/wav'),
    ]);
    return manifest;
  }

  test('parallel uploads to different sound IDs lose a manifest entry', async () => {
    const manifest = await concurrentUploads(false);
    expect(Object.keys(manifest.sounds)).toHaveLength(1);
  });

  test('parallel replacements of one ambience both succeed but delete both WAV files', async () => {
    const manifest = await concurrentUploads(true);
    expect(Object.keys(manifest.sounds)).toHaveLength(1);
    expect(await fs.promises.readdir(path.join(root, 'TableAmbience1'))).toEqual([]);
  });

  test('publication remains blocked by a lock left by a terminated process', async () => {
    await fs.promises.writeFile(path.join(root, '.publish.lock'), '');
    const manager = new WxUpdatePublicationManager(root, path.join(root, 'latest.json'), '', 1000, {} as any, () => {});
    await expect(manager.commit({} as any)).rejects.toThrow('publication WX');
    await expect(manager.commit({} as any)).rejects.toThrow('publication WX');
  });

  test('a transient ambience configuration read failure silently overwrites the previous catalogue', async () => {
    const file = path.join(root, 'table-ambiences.json');
    await fs.promises.writeFile(file, JSON.stringify({ updatedAt: '', items: [
      { soundId: 'TableAmbience1', name: 'Existing ambience', enabled: true },
    ] }));
    const manager = new SoundsTableAmbiencesManager({ filePath: () => file,
      normalizeSoundKey: (id) => id as any, notifyUpdated: async () => {},
      clearSound: async () => ({ ok: true }), storageIoError: (_, error) => error as any,
      now: () => new Date().toISOString(),
    });
    const failedRead = jest.spyOn(fs.promises, 'readFile').mockRejectedValueOnce(Object.assign(new Error('EACCES'), { code: 'EACCES' }));
    try { await manager.create('New ambience'); } finally { failedRead.mockRestore(); }
    const stored = JSON.parse(await fs.promises.readFile(file, 'utf8'));
    expect(stored.items).toEqual([{ soundId: 'TableAmbience1', name: 'New ambience', enabled: true }]);
  });

  test('database failure after refresh rotation invalidates the only token the client knows', async () => {
    let consumed = false;
    const refresh = { rotate: jest.fn(async () => {
      if (consumed) return null;
      consumed = true;
      return { userId: 1, refreshToken: 'new-undelivered-token' };
    }) };
    const service = new RefreshUserSessionService({ findById: jest.fn().mockRejectedValue(new Error('DB temporarily down')) } as any,
      {} as any, refresh as any, { now: Date.now });
    await expect(service.execute('old-token')).rejects.toThrow('DB temporarily down');
    await expect(service.execute('old-token')).rejects.toThrow('Refresh token invalide');
  });

  test('HTTP admin guards accept the role in a signed token without consulting current account state', () => {
    const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const verifier = new JwtPayloadVerifierService({ jwtPublicKeyPem: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      jwtPrivateKeyPem: null, jwtPrivateKeyPath: null, jwtPublicKeyPath: null, jwtIssuer: 'audit', jwtAudience: null, jwtClockToleranceSeconds: 0 });
    const token = sign({ sub: '42', id: 42, roles: ['ROLE_ADMIN'] }, keys.privateKey, { algorithm: 'RS256', issuer: 'audit', expiresIn: '1h' });
    const request = { headers: { authorization: `Bearer ${token}` } };
    const context: any = { switchToHttp: () => ({ getRequest: () => request }) };
    expect(new HttpJwtGuard(verifier).canActivate(context)).toBe(true);
    expect(new AdminRoleGuard().canActivate(context)).toBe(true);
  });
});
