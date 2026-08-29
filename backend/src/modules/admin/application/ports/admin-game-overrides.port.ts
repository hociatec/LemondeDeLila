export interface AdminGameCatalogOverride {
  enabled?: boolean;
  minPlayers?: number;
  maxPlayers?: number;
  name?: string;
  description?: string;
  rules?: string;
  status?: 'construction' | 'beta' | 'finished';
  chatEnabled?: boolean;
  chatSoundsEnabled?: boolean;
}

export interface AdminGameOverridesPort {
  getGameOverride(gameType: string): AdminGameCatalogOverride | undefined;
  setEnabled(gameType: string, enabled: boolean): Promise<void>;
  updateGameOverride(
    gameType: string,
    update: AdminGameCatalogOverride,
  ): Promise<void>;
  clearGameOverride(gameType: string): Promise<void>;
}

export const ADMIN_GAME_OVERRIDES_PORT = Symbol('ADMIN_GAME_OVERRIDES_PORT');
