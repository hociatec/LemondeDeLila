import { Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { verify as jwtVerify, type Algorithm } from 'jsonwebtoken';

import type { WsAuthPayload } from '../../../interfaces/public-api';
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
    return payload as HttpJwtPayload;
  }

  verifyWsToken(token: string): WsAuthPayload {
    const payload = this.verifyRawToken(token);
    if (
      typeof payload.sub !== 'string' ||
      !payload.sub.trim() ||
      typeof payload.id !== 'number' ||
      typeof payload.exp !== 'number' ||
      typeof payload.iat !== 'number'
    ) {
      throw new UnauthorizedException('Token invalide');
    }
    if (!Number.isFinite(payload.id) || payload.id <= 0) {
      throw new UnauthorizedException('Token invalide');
    }
    return payload as unknown as VerifiedWsPayload;
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
      return payload as Record<string, unknown>;
    } catch {
      throw new UnauthorizedException('Token invalide');
    }
  }
}
