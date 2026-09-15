import { AdminBotsService } from './admin-bots.service';

describe('AdminBotsService', () => {
  it('maps bot names to the admin payload shape', async () => {
    const bots = {
      listNames: jest.fn(async () => [
        {
          id: 1,
          name: 'Alpha',
          enabled: true,
          createdAt: '2026-08-20T10:00:00.000Z',
          ignored: 'x',
        },
      ]),
    };
    const service = new AdminBotsService(bots as any);

    const result = await service.listNames();

    expect(result).toEqual({
      names: [
        {
          id: 1,
          name: 'Alpha',
          enabled: true,
          createdAt: '2026-08-20T10:00:00.000Z',
        },
      ],
    });
  });

  it('serializes database dates before sending them over WebSocket', async () => {
    const bots = {
      listNames: jest.fn(async () => [
        {
          id: 1,
          name: 'Alpha',
          enabled: true,
          createdAt: new Date('2026-08-20T10:00:00.000Z'),
        },
      ]),
    };
    const service = new AdminBotsService(bots as any);

    await expect(service.listNames()).resolves.toEqual({
      names: [
        expect.objectContaining({ createdAt: '2026-08-20T10:00:00.000Z' }),
      ],
    });
  });
});
