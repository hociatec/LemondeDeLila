import {
  AdminRoleGuard,
  HttpJwtGuard,
  JwtPayloadVerifierService,
} from '../../../platform/auth/public-api';
import { SoundsService } from '../infrastructure/storage/sounds.service';
import { TABLE_AMBIENCES_READER } from '../application/ports/table-ambiences-reader.port';

export const SOUNDS_CORE_PROVIDERS = [
  SoundsService,
  { provide: TABLE_AMBIENCES_READER, useExisting: SoundsService },
  JwtPayloadVerifierService,
  HttpJwtGuard,
  AdminRoleGuard,
];
