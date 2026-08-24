import type { ClientUpdateMeta } from '../models/client-update-meta.record';

export type ClientUpdatesMetaStorePort = {
  getLatest(): Promise<ClientUpdateMeta | null>;
  saveLatest(meta: ClientUpdateMeta): Promise<void>;
};

export const CLIENT_UPDATES_META_STORE_PORT = Symbol(
  'CLIENT_UPDATES_META_STORE_PORT',
);
