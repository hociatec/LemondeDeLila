import { Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { verify as jwtVerify, type Algorithm } from 'jsonwebtoken';

import type { WsAuthPayload } from '../../../../shared/interfaces/public-api';
import {
  readAuthRuntimeConfigFromEnv,
  type AuthRuntimeConfig,
} from '../ports/auth-runtime-config.port';
import {
  getJwtVerifyAlgorithms,
  requireJwtVerifyKey,
} from './jwt-config.service';

type JwtVerifyOptions = {
  algorithms?: Algorithm[];
  issuer?: string;
  audience?: string;
  clockTolerance?: number;
};

export type HttpJwtPayload = {
  sub: string;
  exp: number;
  iat: number;
  username?: string;
  roles?: string[];
  email?: string;
  id?: number;
};

type VerifiedWsPayload = WsAuthPayload & {
  sub: string;
  exp: number;
  iat: number;
};

@Injectable()
export class JwtPayloadVerifierService {
  private readonly config: AuthRuntimeConfig;

  constructor(@Optional() config?: AuthRuntimeConfig) {
    this.config = config ?? readAuthRuntimeConfigFromEnv();
  }

  verifyHttpToken(token: string): HttpJwtPayload {
    const payload = this.verifyRawToken(token);
    if (
      typeof payload.sub !== 'string' ||
      !payload.sub.trim() ||
      typeof payload.exp !== 'number' ||
      typeof payload.iat !== 'number'
    ) {
      throw new UnauthorizedException('Token invalide');
    }
    return {
      sub: payload.sub,
      exp: payload.exp,
      iat: payload.iat,
      ...(typeof payload.username === 'string'
        ? { username: payload.username }
        : {}),
      ...(isStringArray(payload.roles) ? { roles: payload.roles } : {}),
      ...(typeof payload.email === 'string' ? { email: payload.email } : {}),
      ...(typeof payload.id === 'number' ? { id: payload.id } : {}),
    };
  }

  verifyWsToken(token: string): WsAuthPayload {
    const payload = this.verifyRawToken(token);
    if (
      typeof payload.sub !== 'string' ||
      !payload.sub.trim() ||
      typeof payload.id !== 'number' ||
      typeof payload.username !== 'string' ||
      typeof payload.exp !== 'number' ||
      typeof payload.iat !== 'number'
    ) {
      throw new UnauthorizedException('Token invalide');
    }
    if (!Number.isFinite(payload.id) || payload.id <= 0) {
      throw new UnauthorizedException('Token invalide');
    }
    const verified: VerifiedWsPayload = {
      id: payload.id,
      username: payload.username,
      sub: payload.sub,
      exp: payload.exp,
      iat: payload.iat,
      ...(typeof payload.email === 'string' ? { email: payload.email } : {}),
      ...(isStringArray(payload.roles) ? { roles: payload.roles } : {}),
    };
    return verified;
  }

  private verifyRawToken(token: string): Record<string, unknown> {
    const key = requireJwtVerifyKey(this.config);
    const issuer = this.config.jwtIssuer;
    const audience = this.config.jwtAudience ?? undefined;
    const clockTolerance = this.config.jwtClockToleranceSeconds;

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
      return { ...payload };
    } catch {
      throw new UnauthorizedException('Token invalide');
    }
  }
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}
