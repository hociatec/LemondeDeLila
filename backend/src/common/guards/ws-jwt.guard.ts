import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { WsAuthPayload } from '../interfaces/ws-auth-payload';

@Injectable()
export class WsJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<any>();
    const request = (client as any).req || (client as any).request;
    const handshake = (client as any).handshake;
    const token =
      this.extractBearer((client as any).handshakeHeaders) ||
      this.extractBearer(handshake?.headers) ||
      this.extractBearer(request?.headers) ||
      this.extractBearer(handshake?.auth) ||
      this.extractQueryToken((client as any).url || request?.url) ||
      this.extractQueryToken(handshake?.url) ||
      this.extractQueryTokenFromAuth(handshake?.auth);
    const payload = this.verify(token);
    client.user = payload;
    return true;
  }

  private extractBearer(headers: any): string | null {
    if (!headers) {
      return null;
    }
    const authHeader = headers.authorization || headers.Authorization;
    if (authHeader && typeof authHeader === 'string') {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer' && parts[1]) {
        return parts[1];
      }
    }
    return null;
  }

  private extractQueryTokenFromAuth(auth: any): string | null {
    if (!auth) {
      return null;
    }
    if (typeof auth.token === 'string' && auth.token.trim() !== '') {
      return auth.token;
    }
    return null;
  }

  private extractQueryToken(urlCandidate?: string): string | null {
    if (!urlCandidate || typeof urlCandidate !== 'string') {
      return null;
    }
    try {
      const url = new URL(urlCandidate, 'ws://localhost');
      return url.searchParams.get('token');
    } catch {
      return null;
    }
  }

  private verify(token: string | null): WsAuthPayload {
    if (!token) {
      throw new UnauthorizedException('Token manquant');
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedException('Configuration JWT manquante');
    }
    try {
      return jwt.verify(token, secret) as WsAuthPayload;
    } catch {
      throw new UnauthorizedException('Token invalide');
    }
  }
}
