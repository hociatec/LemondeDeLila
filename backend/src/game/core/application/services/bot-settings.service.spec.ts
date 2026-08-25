import {
  BOT_SETTINGS_REPOSITORY,
  type BotSettingsRepository,
} from '../contracts/bot-settings.repository';
import { BotSettingsService } from './bot-settings.service';

describe('BotSettingsService', () => {
  beforeEach(() => {
    (BotSettingsService as unknown as { sharedCache: unknown }).sharedCache =
      null;
  });

  it('seeds defaults when repository is empty', async () => {
    const repo: BotSettingsRepository = {
      findSettings: jest.fn(async () => null),
      saveSettings: jest.fn(async () => undefined),
    };

    const service = new BotSettingsService(repo);
    await service.onModuleInit();

    expect(repo.findSettings).toHaveBeenCalledTimes(1);
    expect(repo.saveSettings).toHaveBeenCalledWith({
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
    const repo: BotSettingsRepository = {
      findSettings: jest.fn(async () => ({
        botTurnDelayMs: 700,
        botStartDelayMs: 300,
        botDrawDelayMs: 350,
      })),
      saveSettings: jest.fn(async () => undefined),
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
    expect(repo.saveSettings).toHaveBeenLastCalledWith(updated);
  });
});
