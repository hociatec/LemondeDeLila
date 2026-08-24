export type BotSettingsRecord = {
  botTurnDelayMs: number;
  botStartDelayMs: number;
  botDrawDelayMs: number;
};

export const BOT_SETTINGS_REPOSITORY = Symbol('BOT_SETTINGS_REPOSITORY');

export interface BotSettingsRepository {
  findSettings(): Promise<BotSettingsRecord | null>;
  saveSettings(settings: BotSettingsRecord): Promise<void>;
}
