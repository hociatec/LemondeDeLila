import { Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { verify as jwtVerify, type Algorithm } from 'jsonwebtoken';

import type { WsAuthPayload } from '../../../../shared/interfaces/public-api';
import { asUserId } from '../../../../shared/interfaces/public-api';
import {
  readAuthRuntimeConfigFromEnv,
  type AuthRuntimeConfig,
} from '../ports/auth-runtime-config.port';
import { requireJwtVerifyKey } from './jwt-config.service';
import { jwtUserId } from './jwt-user-identity';

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
    const id = jwtUserId(payload);
    if (
      typeof payload.sub !== 'string' ||
      !payload.sub.trim() ||
      payload.sub.length > 128 ||
      typeof payload.exp !== 'number' ||
      typeof payload.iat !== 'number' ||
      !Number.isFinite(payload.exp) ||
      !Number.isFinite(payload.iat) ||
      id === null
    ) {
      throw new UnauthorizedException('Token invalide');
    }
    return {
      sub: payload.sub,
      exp: payload.exp,
      iat: payload.iat,
      ...(isBoundedString(payload.username, 255)
        ? { username: payload.username }
        : {}),
      ...(isStringArray(payload.roles) ? { roles: payload.roles } : {}),
      ...(isBoundedString(payload.email, 320) ? { email: payload.email } : {}),
      id,
    };
  }

  verifyWsToken(token: string): WsAuthPayload {
    const payload = this.verifyRawToken(token);
    if (
      typeof payload.sub !== 'string' ||
      !payload.sub.trim() ||
      payload.sub.length > 128 ||
      typeof payload.id !== 'number' ||
      typeof payload.username !== 'string' ||
      payload.username.length > 255 ||
      typeof payload.exp !== 'number' ||
      typeof payload.iat !== 'number'
    ) {
      throw new UnauthorizedException('Token invalide');
    }
    if (
      jwtUserId(payload) === null ||
      !Number.isFinite(payload.exp) ||
      !Number.isFinite(payload.iat)
    ) {
      throw new UnauthorizedException('Token invalide');
    }
    const verified: VerifiedWsPayload = {
      id: asUserId(payload.id),
      username: payload.username,
      sub: payload.sub,
      exp: payload.exp,
      iat: payload.iat,
      ...(isBoundedString(payload.email, 320) ? { email: payload.email } : {}),
      ...(isStringArray(payload.roles) ? { roles: payload.roles } : {}),
    };
    return verified;
  }

  private verifyRawToken(token: string): Record<string, unknown> {
    if (typeof token !== 'string' || token.length > 16 * 1024) {
      throw new UnauthorizedException('Token invalide');
    }
    const key = requireJwtVerifyKey(this.config);
    const issuer = this.config.jwtIssuer;
    const audience = this.config.jwtAudience ?? undefined;
    const clockTolerance = this.config.jwtClockToleranceSeconds;

    try {
      const verifyOptions: JwtVerifyOptions = {
        algorithms: ['RS256'],
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
    Array.isArray(value) &&
    value.length <= 32 &&
    value.every(
      (item) => typeof item === 'string' && item.length > 0 && item.length <= 64,
    )
  );
}

function isBoundedString(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.length <= maximum;
}
