import type { BotSettingsRepository } from '../ports/bot-settings.repository';
import { BotSettingsService } from './bot-settings.service';

describe('BotSettingsService', () => {
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

  it('does not share settings between service instances', async () => {
    const firstRepo: BotSettingsRepository = {
      findSettings: jest.fn(async () => ({
        botTurnDelayMs: 1,
        botStartDelayMs: 2,
        botDrawDelayMs: 3,
      })),
      saveSettings: jest.fn(async () => undefined),
    };
    const secondRepo: BotSettingsRepository = {
      findSettings: jest.fn(async () => ({
        botTurnDelayMs: 11,
        botStartDelayMs: 12,
        botDrawDelayMs: 13,
      })),
      saveSettings: jest.fn(async () => undefined),
    };

    const first = new BotSettingsService(firstRepo);
    const second = new BotSettingsService(secondRepo);
    await first.onModuleInit();
    await second.onModuleInit();

    expect(first.getSettings()).toEqual({
      botTurnDelayMs: 1,
      botStartDelayMs: 2,
      botDrawDelayMs: 3,
    });
    expect(second.getSettings()).toEqual({
      botTurnDelayMs: 11,
      botStartDelayMs: 12,
      botDrawDelayMs: 13,
    });
  });
});
