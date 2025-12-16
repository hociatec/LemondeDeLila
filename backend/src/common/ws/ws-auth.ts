import { UnauthorizedException } from '@nestjs/common';
import type { WsAuthPayload } from '../interfaces/ws-auth-payload';

export type WsSession = { user: WsAuthPayload | null };

export function requireUser(session: WsSession): WsAuthPayload {
  if (!session.user?.id) {
    throw new UnauthorizedException('Authentification requise');
  }
  return session.user;
}

