export type GameManifestRecord = {
  code?: string;
  name?: string;
  minPlayers?: number;
  maxPlayers?: number;
  summary?: string;
  status?: 'construction' | 'beta' | 'finished';
  chatEnabled?: boolean;
  chatSoundsEnabled?: boolean;
};

export type GameCatalogEntryRecord = {
  root: string;
  manifestPath: string;
  rulesPath?: string;
  manifest: GameManifestRecord;
};
/** Explicitly named data contract at the application boundary. */
