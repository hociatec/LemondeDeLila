import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { verify as jwtVerify, type Algorithm } from 'jsonwebtoken';
import { WsAuthPayload } from '../interfaces/ws-auth-payload';
import {
  getJwtVerifyAlgorithms,
  requireJwtVerifyKey,
} from '../auth/jwt-config';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

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
    const key = requireJwtVerifyKey(this.config);
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
      const verifyOptions: JwtVerifyOptions = {
        algorithms: getJwtVerifyAlgorithms(this.config),
        issuer,
        clockTolerance,
      };
      if (audience) {
        verifyOptions.audience = audience;
      }

      const payload = jwtVerify(token, key, verifyOptions);

      if (!payload || typeof payload !== 'object') {
        throw new UnauthorizedException('Token invalide');
      }
      const typedPayload = payload as Partial<VerifiedWsPayload>;
      if (
        typeof typedPayload.sub !== 'string' ||
        !typedPayload.sub.trim() ||
        typeof typedPayload.id !== 'number' ||
        typeof typedPayload.exp !== 'number' ||
        typeof typedPayload.iat !== 'number'
      ) {
        throw new UnauthorizedException('Token invalide');
      }
      if (!Number.isFinite(typedPayload.id) || typedPayload.id <= 0) {
        throw new UnauthorizedException('Token invalide');
      }
      return typedPayload as VerifiedWsPayload;
    } catch {
      throw new UnauthorizedException('Token invalide');
    }
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

type JwtVerifyOptions = {
  algorithms?: Algorithm[];
  issuer?: string;
  audience?: string;
  clockTolerance?: number;
};

type VerifiedWsPayload = WsAuthPayload & {
  sub: string;
  exp: number;
  iat: number;
};
