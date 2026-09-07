import type { ConfigService } from '@nestjs/config';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { RuntimeHealthIndicator } from './runtime.health';

describe('RuntimeHealthIndicator', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'lila-health-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('checks event-loop lag and writable storage with free-space metadata', async () => {
    const values: Record<string, unknown> = {
      HEALTH_CHECK_PATH: root,
      HEALTH_MIN_FREE_BYTES: 0,
      HEALTH_MAX_EVENT_LOOP_LAG_MS: 10_000,
    };
    const config = {
      get: (key: string, fallback?: unknown) => values[key] ?? fallback,
    } as unknown as ConfigService;
    const indicator = new RuntimeHealthIndicator(config);

    expect(indicator.checkEventLoop('eventLoop')).toMatchObject({
      eventLoop: { status: 'up' },
    });
    await expect(indicator.checkStorage('storage')).resolves.toMatchObject({
      storage: { status: 'up', path: root },
    });
    indicator.onModuleDestroy();
  });
});
