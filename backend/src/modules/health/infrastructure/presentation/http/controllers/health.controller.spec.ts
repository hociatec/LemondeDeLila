import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('separates process liveness from dependency readiness', async () => {
    const health = {
      check: jest.fn(async (checks: Array<() => Promise<unknown>>) => {
        await Promise.all(checks.map((check) => check()));
        return { status: 'ok' };
      }),
    };
    const db = {
      pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }),
    };
    const redis = {
      check: jest.fn().mockResolvedValue({ redis: { status: 'up' } }),
    };
    const bullmq = {
      check: jest.fn().mockResolvedValue({ bullmq: { status: 'up' } }),
    };
    const runtime = {
      checkEventLoop: jest.fn(() => ({ eventLoop: { status: 'up' } })),
      checkStorage: jest.fn().mockResolvedValue({ storage: { status: 'up' } }),
    };
    const controller = new HealthController(
      health as any,
      db as any,
      redis as any,
      bullmq as any,
      runtime as any,
    );

    await expect(controller.live()).resolves.toEqual({ status: 'ok' });
    expect(db.pingCheck).not.toHaveBeenCalled();
    expect(runtime.checkEventLoop).toHaveBeenCalledWith('eventLoop');
    await expect(controller.ready()).resolves.toEqual({ status: 'ok' });
    expect(db.pingCheck).toHaveBeenCalledWith('database');
    expect(redis.check).toHaveBeenCalledWith('redis');
    expect(bullmq.check).toHaveBeenCalledWith('bullmq');
    expect(runtime.checkStorage).toHaveBeenCalledWith('storage');
  });
});
