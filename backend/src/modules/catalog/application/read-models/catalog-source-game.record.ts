export type CatalogSourceGame = {
  id: string;
  name: string;
  description?: string;
  minPlayers?: number;
  maxPlayers?: number;
  chatEnabled?: boolean;
  chatSoundsEnabled?: boolean;
  category?: string;
  subcategory?: string;
  status?: unknown;
  manifestPath?: string;
  rulesPath?: string;
};
/** Explicitly named data contract at the application boundary. */
