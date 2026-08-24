import { UnauthorizedException } from '@nestjs/common';
import type { WsAuthPayload } from '../../../../interfaces/ws-auth-payload';

export type WsSession = {
  user: WsAuthPayload | null;
  connectionId?: string;
};

export function requireUser(session: WsSession): WsAuthPayload {
  if (!session.user?.id) {
    throw new UnauthorizedException('Authentification requise');
  }
  return session.user;
}

export function requireAdmin(session: WsSession): WsAuthPayload {
  const user = requireUser(session);
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const hasAdmin = roles.includes('ROLE_ADMIN') || roles.includes('admin');
  if (!hasAdmin) {
    throw new UnauthorizedException('Rôle administrateur requis');
  }
  return user;
}
