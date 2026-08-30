import { promises as fs } from 'node:fs';
import * as fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  assertPathInside,
  writeFileAtomic,
  writeFileAtomicSync,
} from './atomic-file.utils';

describe('atomic file utilities', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'atomic-file-test-'));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('publishes only complete values under concurrent writes', async () => {
    const target = path.join(root, 'nested', 'value.json');
    const left = JSON.stringify({ source: 'left', data: 'a'.repeat(20_000) });
    const right = JSON.stringify({ source: 'right', data: 'b'.repeat(20_000) });
    await Promise.all([
      writeFileAtomic(target, left),
      writeFileAtomic(target, right),
    ]);
    const result = await fs.readFile(target, 'utf8');
    expect([left, right]).toContain(result);
    expect(await fs.readdir(path.dirname(target))).toEqual(['value.json']);
  });

  it('rejects path traversal outside the storage root', () => {
    expect(() =>
      assertPathInside(root, path.join(root, 'safe', 'file')),
    ).not.toThrow();
    expect(() =>
      assertPathInside(root, path.join(root, '..', 'escape')),
    ).toThrow('Chemin hors du répertoire autorisé');
  });

  it('atomically replaces a file for synchronous stores', () => {
    const target = path.join(root, 'sync.json');
    writeFileAtomicSync(target, 'first');
    writeFileAtomicSync(target, 'second');
    expect(fsSync.readFileSync(target, 'utf8')).toBe('second');
    expect(
      fsSync.readdirSync(root).filter((name) => name.endsWith('.tmp')),
    ).toEqual([]);
  });
});
