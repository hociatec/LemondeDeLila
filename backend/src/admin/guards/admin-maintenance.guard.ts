import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class AdminMaintenanceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!this.isEnabled()) {
      throw new ForbiddenException('Maintenance désactivée sur ce serveur');
    }

    const request = context.switchToHttp().getRequest();
    if (this.isTokenRequired()) {
      const token = String(request?.headers?.['x-admin-maintenance-token'] || '').trim();
      const expected = String(process.env.ADMIN_MAINTENANCE_TOKEN || '').trim();

      if (!expected) {
        throw new ForbiddenException('Maintenance non configurée (token manquant)');
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
    const raw = String(process.env.ADMIN_MAINTENANCE_ENABLED || '').trim().toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'yes';
  }

  private isTokenRequired(): boolean {
    const raw = String(process.env.ADMIN_MAINTENANCE_REQUIRE_TOKEN || '')
      .trim()
      .toLowerCase();
    if (!raw) return true; // default: required
    return !(raw === '0' || raw === 'false' || raw === 'no');
  }

  private getIpAllowlist(): string[] {
    const raw = String(process.env.ADMIN_MAINTENANCE_ALLOWED_IPS || '').trim();
    if (!raw) return [];
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private getRequestIp(request: any): string | null {
    const forwarded = String(request?.headers?.['x-forwarded-for'] || '').trim();
    const ip = forwarded ? forwarded.split(',')[0]?.trim() : String(request?.ip || '').trim();
    if (!ip) return null;
    // Normalize "::ffff:1.2.3.4" style addresses.
    return ip.startsWith('::ffff:') ? ip.slice('::ffff:'.length) : ip;
  }
}
