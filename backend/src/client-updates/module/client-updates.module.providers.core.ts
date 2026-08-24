import { ClientUpdatesMetaStoreService } from '../infrastructure/filesystem/client-updates-meta-store.service';
import { ClientUpdatesPathsService } from '../infrastructure/filesystem/client-updates-paths.service';
import { ClientUpdatesPublisherService } from '../infrastructure/filesystem/client-updates-publisher.service';
import { ClientUpdatesUploadStoreService } from '../infrastructure/filesystem/client-updates-upload-store.service';
import { CLIENT_UPDATES_META_STORE_PORT } from '../application/ports/client-updates-meta-store.port';
import { CLIENT_UPDATES_PATHS_PORT } from '../application/ports/client-updates-paths.port';
import { CLIENT_UPDATES_PUBLISHER_PORT } from '../application/ports/client-updates-publisher.port';
import { CLIENT_UPDATES_UPLOAD_STORE_PORT } from '../application/ports/client-updates-upload-store.port';

export const CLIENT_UPDATES_CORE_PROVIDERS = [
  ClientUpdatesPathsService,
  ClientUpdatesMetaStoreService,
  ClientUpdatesPublisherService,
  ClientUpdatesUploadStoreService,
  {
    provide: CLIENT_UPDATES_PATHS_PORT,
    useExisting: ClientUpdatesPathsService,
  },
  {
    provide: CLIENT_UPDATES_META_STORE_PORT,
    useExisting: ClientUpdatesMetaStoreService,
  },
  {
    provide: CLIENT_UPDATES_PUBLISHER_PORT,
    useExisting: ClientUpdatesPublisherService,
  },
  {
    provide: CLIENT_UPDATES_UPLOAD_STORE_PORT,
    useExisting: ClientUpdatesUploadStoreService,
  },
];
