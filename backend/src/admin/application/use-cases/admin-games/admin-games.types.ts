export type AdminGameCatalogStatus =
  | 'construction'
  | 'beta'
  | 'finished';

export interface UpdateAdminGameCommand {
  gameType: string;
  enabled?: boolean;
  minPlayers?: number;
  maxPlayers?: number;
  name?: string;
  description?: string;
  rules?: string;
  status?: AdminGameCatalogStatus;
  chatEnabled?: boolean;
  chatSoundsEnabled?: boolean;
}
