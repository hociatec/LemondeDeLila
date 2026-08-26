import type { BotSettingsRepository } from '../contracts/bot-settings.repository';
import { BotSettingsService } from './bot-settings.service';

describe('BotSettingsService', () => {
  beforeEach(() => {
    (BotSettingsService as unknown as { sharedCache: unknown }).sharedCache =
      null;
  });

  it('seeds defaults when repository is empty', async () => {
    const findSettings = jest.fn(async () => null);
    const saveSettings = jest.fn(async () => undefined);
    const repo: BotSettingsRepository = {
      findSettings,
      saveSettings,
    };

    const service = new BotSettingsService(repo);
    await service.onModuleInit();

    expect(findSettings).toHaveBeenCalledTimes(1);
    expect(saveSettings).toHaveBeenCalledWith({
      botTurnDelayMs: 600,
      botStartDelayMs: 250,
      botDrawDelayMs: 250,
    });
    expect(service.getSettings()).toEqual({
      botTurnDelayMs: 600,
      botStartDelayMs: 250,
      botDrawDelayMs: 250,
    });
  });

  it('clamps and persists updated settings', async () => {
    const findSettings = jest.fn(async () => ({
      botTurnDelayMs: 700,
      botStartDelayMs: 300,
      botDrawDelayMs: 350,
    }));
    const saveSettings = jest.fn(async () => undefined);
    const repo: BotSettingsRepository = {
      findSettings,
      saveSettings,
    };

    const service = new BotSettingsService(repo);
    await service.onModuleInit();

    const updated = await service.updateSettings({
      botTurnDelayMs: -10,
      botStartDelayMs: 999999,
      botDrawDelayMs: 150,
    });

    expect(updated).toEqual({
      botTurnDelayMs: 0,
      botStartDelayMs: 60000,
      botDrawDelayMs: 150,
    });
    expect(saveSettings).toHaveBeenLastCalledWith(updated);
  });
});
