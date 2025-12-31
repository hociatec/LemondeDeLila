import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import type { WsAuthPayload } from '../interfaces/ws-auth-payload';
import type { WebSocket } from 'ws';

type StrictWsAuthPayload = WsAuthPayload & jwt.JwtPayload;

@Injectable()
export class WsJwtAuthService {
  constructor(private readonly config: ConfigService) {}

  extractToken(client: WebSocket, args: any[]): string | null {
    const request: any =
      (args && args[0]) || (client as any).upgradeReq || (client as any).req;
    const urlCandidate = (client as any).url || request?.url || '';
    const headerToken =
      this.extractBearer((client as any).handshakeHeaders) ||
      this.extractBearer(request?.headers);
    if (headerToken) {
      return headerToken;
    }
    return this.extractQueryToken(urlCandidate);
  }

  extractClientVersion(client: WebSocket, args: any[]): string | null {
    const request: any =
      (args && args[0]) || (client as any).upgradeReq || (client as any).req;
    const urlCandidate = (client as any).url || request?.url || '';

    const headers = (client as any).handshakeHeaders || request?.headers;
    const headerVersion =
      (headers?.['x-lila-client-version'] as string | undefined) ||
      (headers?.['X-Lila-Client-Version'] as string | undefined);
    if (headerVersion && typeof headerVersion === 'string') {
      const trimmed = headerVersion.trim();
      if (trimmed) return trimmed;
    }

    if (urlCandidate && typeof urlCandidate === 'string') {
      try {
        const url = new URL(urlCandidate, 'ws://localhost');
        const v =
          url.searchParams.get('v') ||
          url.searchParams.get('version') ||
          url.searchParams.get('clientVersion') ||
          null;
        const trimmed = (v || '').trim();
        return trimmed || null;
      } catch {
        return null;
      }
    }

    return null;
  }

  verify(token: string): WsAuthPayload {
    const secret = this.requireSecret();
    const issuer = this.config.get<string>('JWT_ISSUER', 'le-monde-de-lila');
    const audienceRaw = this.config.get<string>('JWT_AUDIENCE');
    const audience =
      audienceRaw && typeof audienceRaw === 'string' && audienceRaw.trim()
        ? audienceRaw.trim()
        : undefined;
    const clockTolerance = this.config.get<number>(
      'JWT_CLOCK_TOLERANCE_SECONDS',
      10,
    );
    try {
      const verifyOptions: jwt.VerifyOptions = {
        algorithms: ['HS256'],
        issuer,
        clockTolerance,
      };
      if (audience) {
        verifyOptions.audience = audience;
      }

      const payload = jwt.verify(
        token,
        secret,
        verifyOptions,
      ) as StrictWsAuthPayload;

      if (!payload || typeof payload !== 'object') {
        throw new UnauthorizedException('Token invalide');
      }
      if (
        typeof payload.sub !== 'string' ||
        !payload.sub.trim() ||
        typeof payload.exp !== 'number' ||
        typeof payload.iat !== 'number'
      ) {
        throw new UnauthorizedException('Token invalide');
      }
      if (!Number.isFinite(payload.id) || (payload.id as number) <= 0) {
        throw new UnauthorizedException('Token invalide');
      }
      return payload;
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
    const secret =
      this.config.get<string>('JWT_SECRET') || process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedException('Configuration JWT manquante');
    }
    return secret;
  }
}
