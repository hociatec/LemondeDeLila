export const VAULT_BOT_PORT = Symbol('VAULT_BOT_PORT');

export interface VaultBotPort {
  addSystemBot(roomId: number): Promise<{ id: number }>;
  renameBot(botId: number, name: string): Promise<void>;
}
