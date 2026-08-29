import { AdminGameOverridesService } from './admin-game-overrides.service';

describe('AdminGameOverridesService', () => {
  it('builds a partial override from provided fields only', async () => {
    const overrides = {
      updateGameOverride: jest.fn(async () => undefined),
    };
    const service = new AdminGameOverridesService(overrides as any);

    await service.update({
      gameType: 'morpion',
      enabled: false,
      minPlayers: 2,
      status: 'beta',
      chatEnabled: true,
    });

    expect(overrides.updateGameOverride).toHaveBeenCalledWith('morpion', {
      enabled: false,
      minPlayers: 2,
      status: 'beta',
      chatEnabled: true,
    });
  });
});
