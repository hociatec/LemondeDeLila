import { AdminBotsService } from './admin-bots.service';

describe('AdminBotsService', () => {
  it('maps bot names to the admin payload shape', async () => {
    const listBotNamesUseCase = {
      execute: jest.fn(async () => [
        {
          id: 1,
          name: 'Alpha',
          enabled: true,
          createdAt: '2026-08-20T10:00:00.000Z',
          ignored: 'x',
        },
      ]),
    };
    const settings = {} as any;
    const service = new AdminBotsService(
      listBotNamesUseCase as any,
      {} as any,
      {} as any,
      {} as any,
      settings,
    );

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
});
