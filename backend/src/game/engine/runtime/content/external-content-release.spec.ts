import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GameContentValidationError } from '../../../core/domain/errors/game-domain.errors';
import {
  clearExternalContentReleaseCache,
  loadExternalGameContent,
} from './external-content-release';

describe('external content releases', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-content-'));
    fs.mkdirSync(path.join(root, 'games'));
    clearExternalContentReleaseCache();
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('loads a payload only when its manifest and checksum are exact', () => {
    writeRelease('lama', { cards: [{ id: 1 }] });

    expect(
      loadExternalGameContent('lama', { LILA_CONTENT_RELEASE_DIR: root }),
    ).toEqual({
      source: { cards: [{ id: 1 }] },
      version: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(
      loadExternalGameContent('corridor', { LILA_CONTENT_RELEASE_DIR: root }),
    ).toBeNull();
  });

  it('rejects altered payloads, invalid manifests and escaping paths', () => {
    writeRelease('lama', { cards: [] });
    fs.writeFileSync(path.join(root, 'games/lama.json'), '{}\n');
    expect(() =>
      loadExternalGameContent('lama', { LILA_CONTENT_RELEASE_DIR: root }),
    ).toThrow('Checksum');

    clearExternalContentReleaseCache();
    fs.writeFileSync(path.join(root, 'manifest.json'), '{}\n');
    expect(() =>
      loadExternalGameContent('lama', { LILA_CONTENT_RELEASE_DIR: root }),
    ).toThrow('Contrat de release');

    const hash = 'a'.repeat(64);
    clearExternalContentReleaseCache();
    fs.writeFileSync(
      path.join(root, 'manifest.json'),
      JSON.stringify(manifest('lama', '../outside.json', hash)),
    );
    expect(() =>
      loadExternalGameContent('lama', { LILA_CONTENT_RELEASE_DIR: root }),
    ).toThrow('hors release');
  });

  it('wraps unreadable and malformed JSON as domain errors', () => {
    const raw = '{';
    const hash = sha256(raw);
    fs.writeFileSync(path.join(root, 'games/lama.json'), raw);
    fs.writeFileSync(
      path.join(root, 'manifest.json'),
      JSON.stringify(manifest('lama', 'games/lama.json', hash)),
    );
    expect(() =>
      loadExternalGameContent('lama', { LILA_CONTENT_RELEASE_DIR: root }),
    ).toThrow(GameContentValidationError);

    clearExternalContentReleaseCache();
    fs.rmSync(path.join(root, 'manifest.json'));
    expect(() =>
      loadExternalGameContent('lama', { LILA_CONTENT_RELEASE_DIR: root }),
    ).toThrow('Manifest de contenu invalide');
  });

  function writeRelease(gameId: string, value: unknown): void {
    const raw = `${JSON.stringify(value)}\n`;
    const hash = sha256(raw);
    fs.writeFileSync(path.join(root, `games/${gameId}.json`), raw);
    fs.writeFileSync(
      path.join(root, 'manifest.json'),
      JSON.stringify(manifest(gameId, `games/${gameId}.json`, hash)),
    );
  }
});

function manifest(gameId: string, file: string, hash: string) {
  return {
    kind: 'lila.content-release',
    schemaVersion: 1,
    releaseId: 'release',
    games: {
      [gameId]: { file, sha256: hash, contentVersion: hash },
    },
  };
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
