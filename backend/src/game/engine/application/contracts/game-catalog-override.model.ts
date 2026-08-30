export type GameCatalogStatus = 'construction' | 'beta' | 'finished';

export type GameCatalogOverrideRecord = {
  enabled?: boolean;
  minPlayers?: number;
  maxPlayers?: number;
  name?: string;
  description?: string;
  rules?: string;
  status?: GameCatalogStatus;
  chatEnabled?: boolean;
  chatSoundsEnabled?: boolean;
};
/** Explicitly named data contract at the application boundary. */
