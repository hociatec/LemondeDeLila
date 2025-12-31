import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { WsAuthPayload } from '../interfaces/ws-auth-payload';

type StrictWsAuthPayload = WsAuthPayload & jwt.JwtPayload;

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<any>();
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

  private extractBearer(headers: any): string | null {
    if (!headers) {
      return null;
    }
    const authHeader = headers.authorization || headers.Authorization;
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
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new UnauthorizedException('Configuration JWT manquante');
    }
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
}
