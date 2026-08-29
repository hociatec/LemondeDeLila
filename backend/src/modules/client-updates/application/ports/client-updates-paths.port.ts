export type ClientUpdatesPathsPort = {
  getTargetDir(): string;
  getMetaPath(): string;
  getUploadsRoot(): string;
  getPublicUrl(): string | null;
  getLegacyApplicationName(): string;
  getLatestZipName(): string;
};

export const CLIENT_UPDATES_PATHS_PORT = Symbol('CLIENT_UPDATES_PATHS_PORT');
