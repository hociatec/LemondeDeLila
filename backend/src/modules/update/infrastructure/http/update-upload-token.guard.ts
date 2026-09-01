import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { readEnvironment } from '../../../../platform/config/public-api';
import { constantTimeSecretEquals } from '../../../../shared/utils/public-api';

@Injectable()
export class UpdateUploadTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const configured = readEnvironment('CLIENT_WX_UPDATES_UPLOAD_TOKEN').trim();
    const provided = String(
      request.headers['x-client-wx-updates-upload-token'] || '',
    ).trim();
    if (!configured) {
      throw new UnauthorizedException(
        'CLIENT_WX_UPDATES_UPLOAD_TOKEN non configuré',
      );
    }
    if (!constantTimeSecretEquals(configured, provided)) {
      throw new UnauthorizedException('Token upload invalide');
    }
    return true;
  }
}
