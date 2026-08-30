import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  assertStorageCapacity,
  StorageCapacityError,
} from './storage-capacity';

describe('assertStorageCapacity', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'storage-quota-'));
  });

  afterEach(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  it('rejects an incoming file that would exceed the aggregate quota', async () => {
    await fs.promises.writeFile(
      path.join(root, 'existing.bin'),
      Buffer.alloc(6),
    );
    await expect(
      assertStorageCapacity({
        root,
        incomingBytes: 5,
        maxTotalBytes: 10,
        minFreeBytes: 0,
      }),
    ).rejects.toMatchObject<Partial<StorageCapacityError>>({ reason: 'quota' });
  });

  it('accepts an upload within quota and disk reserve', async () => {
    await expect(
      assertStorageCapacity({
        root,
        incomingBytes: 1,
        maxTotalBytes: 10,
        minFreeBytes: 0,
      }),
    ).resolves.toBeUndefined();
  });

  it('rejects an upload when the real filesystem free-space reserve cannot be met', async () => {
    await expect(
      assertStorageCapacity({
        root,
        incomingBytes: 1,
        maxTotalBytes: Number.MAX_SAFE_INTEGER,
        minFreeBytes: Number.MAX_SAFE_INTEGER,
      }),
    ).rejects.toMatchObject<Partial<StorageCapacityError>>({
      reason: 'disk-free',
    });
  });
});
