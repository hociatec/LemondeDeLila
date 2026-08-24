import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * Guard for CI uploads (GitHub Actions, etc.) without requiring a JWT admin login.
 * Uses env var `CLIENT_UPDATES_UPLOAD_TOKEN` matched against header:
 *   x-client-updates-upload-token: <token>
 */
@Injectable()
export class ClientUpdatesUploadTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const configured = (process.env.CLIENT_UPDATES_UPLOAD_TOKEN || '').trim();
    if (!configured) {
      throw new UnauthorizedException(
        'CLIENT_UPDATES_UPLOAD_TOKEN non configuré',
      );
    }

    const token =
      (req?.headers?.['x-client-updates-upload-token'] as string | undefined) ||
      (req?.headers?.['X-Client-Updates-Upload-Token'] as string | undefined) ||
      '';
    if (typeof token !== 'string' || token.trim() !== configured) {
      throw new UnauthorizedException('Token upload invalide');
    }
    return true;
  }
}
