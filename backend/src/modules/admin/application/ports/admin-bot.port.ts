export const ADMIN_BOT_PORT = Symbol('ADMIN_BOT_PORT');

export type AdminBotName = {
  id: number;
  name: string;
  enabled: boolean;
  createdAt: Date | string | null;
};

export type AdminBotSettings = {
  botTurnDelayMs: number;
  botStartDelayMs: number;
  botDrawDelayMs: number;
};

export interface AdminBotPort {
  listNames(): Promise<AdminBotName[]>;
  createName(name: string, enabled: boolean): Promise<void>;
  updateName(
    id: number,
    update: { name?: string; enabled?: boolean },
  ): Promise<void>;
  deleteName(id: number): Promise<void>;
  getSettings(): AdminBotSettings;
  updateSettings(update: Partial<AdminBotSettings>): Promise<AdminBotSettings>;
}
