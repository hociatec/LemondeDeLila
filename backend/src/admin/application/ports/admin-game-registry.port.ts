export interface AdminGameRegistryPort {
  listGames(options?: {
    includeDisabledOverrides?: boolean;
  }): Promise<
    Array<{
      id: string;
      name: string;
      category?: string | null;
      subcategory?: string | null;
      description?: string | null;
      minPlayers: number;
      maxPlayers: number;
      chatEnabled?: boolean;
      chatSoundsEnabled?: boolean;
    }>
  >;

  invalidateCache(): void;
}

export const ADMIN_GAME_REGISTRY_PORT = Symbol('ADMIN_GAME_REGISTRY_PORT');
