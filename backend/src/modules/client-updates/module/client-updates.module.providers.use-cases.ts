import { ClientUpdatesService } from '../application/use-cases/client-updates/client-updates.service';
import { ClientUpdatesUploadService } from '../infrastructure/filesystem/client-updates-upload.service';

export const CLIENT_UPDATES_USE_CASE_PROVIDERS = [
  ClientUpdatesService,
  ClientUpdatesUploadService,
];
