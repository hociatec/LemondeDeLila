import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { HttpJwtGuard } from '../../common/guards/http-jwt.guard';
import { ClientUpdatesUploadTokenGuard } from '../guards/client-updates-upload-token.guard';
import { ClientUpdatesService } from '../services/client-updates.service';
import { ClientUpdatesStaticService } from '../services/client-updates-static.service';
import { ClientUpdatesUploadService } from '../services/client-updates-upload.service';

export const CLIENT_UPDATES_MODULE_PROVIDERS = [
  ClientUpdatesService,
  ClientUpdatesStaticService,
  ClientUpdatesUploadService,
  HttpJwtGuard,
  AdminRoleGuard,
  ClientUpdatesUploadTokenGuard,
];
