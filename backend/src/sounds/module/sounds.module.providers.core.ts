import {
  AdminRoleGuard,
  HttpJwtGuard,
  JwtPayloadVerifierService,
} from '../../common/auth/public-api';
import { SoundsService } from '../infrastructure/storage/sounds.service';

export const SOUNDS_CORE_PROVIDERS = [
  SoundsService,
  JwtPayloadVerifierService,
  HttpJwtGuard,
  AdminRoleGuard,
];
