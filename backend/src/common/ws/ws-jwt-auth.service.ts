import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import type { WsAuthPayload } from '../interfaces/ws-auth-payload';
import type { WebSocket } from 'ws';

@Injectable()
export class WsJwtAuthService {
  constructor(private readonly config: ConfigService) {}

  extractToken(client: WebSocket, args: any[]): string | null {
    const request: any = (args && args[0]) || (client as any).upgradeReq || (client as any).req;
    const urlCandidate = (client as any).url || request?.url || '';
    const headerToken =
      this.extractBearer((client as any).handshakeHeaders) || this.extractBearer(request?.headers);
    if (headerToken) {
      return headerToken;
    }
    return this.extractQueryToken(urlCandidate);
  }

  verify(token: string): WsAuthPayload {
    const secret = this.requireSecret();
    try {
      return jwt.verify(token, secret) as WsAuthPayload;
    } catch {
      throw new UnauthorizedException('Token invalide');
    }
  }

  tryVerify(token: string | null): WsAuthPayload | null {
    if (!token) return null;
    try {
      return this.verify(token);
    } catch {
      return null;
    }
  }

  private extractBearer(headers: any): string | null {
    if (!headers) return null;
    const authHeader = headers.authorization || headers.Authorization;
    if (authHeader && typeof authHeader === 'string') {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        return parts[1];
      }
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

  private requireSecret(): string {
    const secret = this.config.get<string>('JWT_SECRET') || process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedException('Configuration JWT manquante');
    }
    return secret;
  }
}

