import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class AdminMaintenanceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!this.isEnabled()) {
      throw new ForbiddenException('Maintenance désactivée sur ce serveur');
    }

    const request = context.switchToHttp().getRequest();
    const token = String(request?.headers?.['x-admin-maintenance-token'] || '').trim();
    const expected = String(process.env.ADMIN_MAINTENANCE_TOKEN || '').trim();

    if (!expected) {
      throw new ForbiddenException('Maintenance non configurée (token manquant)');
    }

    if (!token || token !== expected) {
      throw new ForbiddenException('Token de maintenance invalide');
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

  private getIpAllowlist(): string[] {
    const raw = String(process.env.ADMIN_MAINTENANCE_ALLOWED_IPS || '').trim();
    if (!raw) return [];
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private getRequestIp(request: any): string | null {
    const ip = String(request?.ip || '').trim();
    if (ip) return ip;
    const forwarded = String(request?.headers?.['x-forwarded-for'] || '').trim();
    if (!forwarded) return null;
    return forwarded.split(',')[0]?.trim() || null;
  }
}

