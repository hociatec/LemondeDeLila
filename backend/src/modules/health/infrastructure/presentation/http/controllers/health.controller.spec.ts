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
    const controller = new HealthController(
      health as any,
      db as any,
      redis as any,
    );

    expect(controller.live()).toEqual({ status: 'ok' });
    expect(db.pingCheck).not.toHaveBeenCalled();
    await expect(controller.ready()).resolves.toEqual({ status: 'ok' });
    expect(db.pingCheck).toHaveBeenCalledWith('database');
    expect(redis.check).toHaveBeenCalledWith('redis');
  });
});
