import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { readEnvironment } from '../../../config/public-api';

@Injectable()
export class UpdateUploadTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const configured = readEnvironment('CLIENT_UPDATES_UPLOAD_TOKEN').trim();
    const provided = String(
      request.headers['x-client-updates-upload-token'] || '',
    ).trim();
    if (!configured) {
      throw new UnauthorizedException(
        'CLIENT_UPDATES_UPLOAD_TOKEN non configuré',
      );
    }
    const expectedBytes = Buffer.from(configured, 'utf-8');
    const providedBytes = Buffer.from(provided, 'utf-8');
    if (
      expectedBytes.length !== providedBytes.length ||
      !timingSafeEqual(expectedBytes, providedBytes)
    ) {
      throw new UnauthorizedException('Token upload invalide');
    }
    return true;
  }
}
