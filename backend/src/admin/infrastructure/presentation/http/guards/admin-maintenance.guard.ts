import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  readEnvironment,
  readEnvironmentBoolean,
} from '../../../../../config/public-api';

@Injectable()
export class AdminMaintenanceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!this.isEnabled()) {
      throw new ForbiddenException('Maintenance désactivée sur ce serveur');
    }

    const request = context.switchToHttp().getRequest<Request>();
    if (this.isTokenRequired()) {
      const token = String(
        request?.headers?.['x-admin-maintenance-token'] || '',
      ).trim();
      const expected = readEnvironment('ADMIN_MAINTENANCE_TOKEN').trim();

      if (!expected) {
        throw new ForbiddenException(
          'Maintenance non configurée (token manquant)',
        );
      }

      if (!token || token !== expected) {
        throw new ForbiddenException('Token de maintenance invalide');
      }
    }

    const ipAllowlist = this.getIpAllowlist();
    if (ipAllowlist.length > 0) {
      const ip = this.getRequestIp(request);
      if (!ip || !ipAllowlist.includes(ip)) {
        throw new ForbiddenException('IP non autorisée pour la maintenance');
      }
    }

    return true;
  }

  private isEnabled(): boolean {
    return readEnvironmentBoolean('ADMIN_MAINTENANCE_ENABLED', false);
  }

  private isTokenRequired(): boolean {
    return readEnvironmentBoolean('ADMIN_MAINTENANCE_REQUIRE_TOKEN', true);
  }

  private getIpAllowlist(): string[] {
    const raw = readEnvironment('ADMIN_MAINTENANCE_ALLOWED_IPS').trim();
    if (!raw) return [];
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private getRequestIp(request: Request): string | null {
    const forwarded = String(request.headers['x-forwarded-for'] || '').trim();
    const ip = forwarded
      ? forwarded.split(',')[0]?.trim()
      : String(request.ip || '').trim();
    if (!ip) return null;
    // Normalize "::ffff:1.2.3.4" style addresses.
    return ip.startsWith('::ffff:') ? ip.slice('::ffff:'.length) : ip;
  }
}
