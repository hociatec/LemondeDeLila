import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { WsAuthPayload } from '../../../../interfaces/public-api';
import { JwtPayloadVerifierService } from '../../../application/services/jwt-payload-verifier.service';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly verifier: JwtPayloadVerifierService) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<WsClient>();
    const request = client.req || client.request;
    const handshake = client.handshake;
    const token =
      this.extractBearer(client.handshakeHeaders) ||
      this.extractBearer(handshake?.headers) ||
      this.extractBearer(request?.headers) ||
      this.extractBearer(handshake?.auth) ||
      this.extractQueryToken(client.url || request?.url) ||
      this.extractQueryToken(handshake?.url) ||
      this.extractQueryTokenFromAuth(handshake?.auth);
    const payload = this.verify(token);
    client.user = payload;
    return true;
  }

  private extractBearer(
    headers: Record<string, unknown> | undefined,
  ): string | null {
    if (!headers) {
      return null;
    }
    const authHeader = headers['authorization'] || headers['Authorization'];
    if (authHeader && typeof authHeader === 'string') {
      const parts = authHeader.split(' ');
      if (
        parts.length === 2 &&
        parts[0].toLowerCase() === 'bearer' &&
        parts[1]
      ) {
        return parts[1];
      }
    }
    return null;
  }

  private extractQueryTokenFromAuth(
    auth: Record<string, unknown> | undefined,
  ): string | null {
    if (!auth) {
      return null;
    }
    const token = auth['token'];
    if (typeof token === 'string' && token.trim() !== '') {
      return token;
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
    return this.verifier.verifyWsToken(token);
  }
}

type WsHandshake = {
  headers?: Record<string, unknown>;
  auth?: Record<string, unknown>;
  url?: string;
};

type WsClient = {
  req?: Request;
  request?: Request;
  handshake?: WsHandshake;
  handshakeHeaders?: Record<string, unknown>;
  url?: string;
  user?: WsAuthPayload;
};
