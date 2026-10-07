import { BadRequestException } from '@nestjs/common';
import { AdminSoundsController } from './admin-sounds.controller';

describe('AdminSoundsController', () => {
  it('returns the categorized sound catalog', async () => {
    const sounds: any = {
      getAdminCatalog: jest.fn().mockResolvedValue({ categories: [] }),
    };
    const controller = new AdminSoundsController(sounds);

    await expect(controller.catalog()).resolves.toEqual({ categories: [] });
    expect(sounds.getAdminCatalog).toHaveBeenCalledTimes(1);
  });

  it('enables or disables a standard sound', async () => {
    const sounds: any = {
      setSoundEnabled: jest
        .fn()
        .mockResolvedValue({ soundId: 'TavernOpened', enabled: false }),
    };
    const controller = new AdminSoundsController(sounds);

    await controller.setSoundEnabled('TavernOpened', { enabled: false });

    expect(sounds.setSoundEnabled).toHaveBeenCalledWith('TavernOpened', false);
  });

  it('lists table ambiences including disabled entries', async () => {
    const sounds: any = {
      listTableAmbiencesWithFilter: jest.fn().mockResolvedValue({
        updatedAt: '2026-03-02T00:00:00.000Z',
        items: [
          { soundId: 'TableAmbience1', name: 'A1', enabled: true },
          { soundId: 'TableAmbience2', name: 'A2', enabled: false },
        ],
      }),
    };
    const controller = new AdminSoundsController(sounds);

    const out = await controller.listTableAmbiences();

    expect(sounds.listTableAmbiencesWithFilter).toHaveBeenCalledWith({
      includeDisabled: true,
    });
    expect(out.items).toHaveLength(2);
  });

  it('rejects setTableAmbienceEnabled when enabled is missing', async () => {
    const sounds: any = {};
    const controller = new AdminSoundsController(sounds);

    await expect(
      controller.setTableAmbienceEnabled('TableAmbience1', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('forwards setTableAmbienceEnabled with a boolean payload', async () => {
    const sounds: any = {
      setTableAmbienceEnabled: jest.fn().mockResolvedValue({
        soundId: 'TableAmbience1',
        name: 'A1',
        enabled: false,
      }),
    };
    const controller = new AdminSoundsController(sounds);

    const out = await controller.setTableAmbienceEnabled('TableAmbience1', {
      enabled: false,
    });

    expect(sounds.setTableAmbienceEnabled).toHaveBeenCalledWith(
      'TableAmbience1',
      false,
    );
    expect(out.enabled).toBe(false);
  });

  it('rejects unknown body fields', async () => {
    const controller = new AdminSoundsController(
      {} as ConstructorParameters<typeof AdminSoundsController>[0],
    );
    const ambience = { name: 'Forest', admin: true };
    const enabled = { enabled: true, hidden: true };

    await expect(
      controller.createTableAmbience(ambience),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.setTableAmbienceEnabled('TableAmbience1', enabled),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
