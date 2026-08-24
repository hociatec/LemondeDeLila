export type GameCatalogOverrideRecord = {
  enabled?: boolean;
  minPlayers?: number;
  maxPlayers?: number;
  name?: string;
  description?: string;
  rules?: string;
  status?: string;
  chatEnabled?: boolean;
  chatSoundsEnabled?: boolean;
};
