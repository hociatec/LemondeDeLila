import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

type JwtUserPayload = {
  roles?: string[];
};

@Injectable()
export class AdminRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const payload = (request?.user || {}) as JwtUserPayload;
    const roles = Array.isArray(payload.roles) ? payload.roles : [];
    const hasAdmin = roles.includes('ROLE_ADMIN') || roles.includes('admin');
    if (!hasAdmin) {
      throw new ForbiddenException('Accès administrateur requis');
    }
    return true;
  }
}
