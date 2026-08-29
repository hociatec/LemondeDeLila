import {
  AdminRoleGuard,
  HttpJwtGuard,
  JwtPayloadVerifierService,
} from '../../../platform/auth/public-api';
import { ClientUpdatesStaticService } from '../infrastructure/presentation/http/client-updates-static.service';
import { ClientUpdatesUploadTokenGuard } from '../infrastructure/presentation/http/guards/client-updates-upload-token.guard';

export const CLIENT_UPDATES_PRESENTATION_PROVIDERS = [
  ClientUpdatesStaticService,
  JwtPayloadVerifierService,
  HttpJwtGuard,
  AdminRoleGuard,
  ClientUpdatesUploadTokenGuard,
];
