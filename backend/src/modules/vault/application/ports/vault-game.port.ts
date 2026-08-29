import type { VaultGameState } from '../models/vault-game-state.model';

export const VAULT_GAME_PORT = Symbol('VAULT_GAME_PORT');

export interface VaultGamePort {
  exportState(roomId: number, gameType: string): Promise<VaultGameState | null>;
  restoreState(
    roomId: number,
    gameType: string,
    state: VaultGameState,
  ): Promise<void>;
  getDisplayName(gameType: string): string | null;
}
