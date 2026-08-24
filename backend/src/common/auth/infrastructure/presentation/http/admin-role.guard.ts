import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

type JwtUserPayload = {
  roles?: string[];
};

type RequestWithUser = Request & { user?: JwtUserPayload };

@Injectable()
export class AdminRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const payload = request.user ?? {};
    const roles = Array.isArray(payload.roles) ? payload.roles : [];
    const hasAdmin = roles.includes('ROLE_ADMIN') || roles.includes('admin');
    if (!hasAdmin) {
      throw new ForbiddenException('Accès administrateur requis');
    }
    return true;
  }
}
