export const VAULT_PRESENCE_PORT = Symbol('VAULT_PRESENCE_PORT');

export interface VaultPresencePort {
  isUserInTavern(userId: number): boolean;
}
