import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import type {
  UserTokenPayload,
  UserTokenServicePort,
} from '../../application/ports/user-token.port';
import {
  type AuthRuntimeConfig,
  getJwtAlgorithm,
  requireJwtSigningKey,
} from '../../../common/auth/public-api';

@Injectable()
export class JwtUserTokenService implements UserTokenServicePort {
  private readonly jwtSigningKey: string;
  private readonly jwtAlgorithm: jwt.Algorithm;
  private readonly jwtExpiresIn: jwt.SignOptions['expiresIn'];
  private readonly jwtIssuer: string;
  private readonly jwtAudience: string | undefined;

  constructor(private readonly config: ConfigService) {
    const authConfig = this.toAuthRuntimeConfig(config);
    this.jwtSigningKey = requireJwtSigningKey(authConfig);
    this.jwtAlgorithm = getJwtAlgorithm(authConfig);
    this.jwtExpiresIn = this.config.get<jwt.SignOptions['expiresIn']>(
      'JWT_EXPIRES_IN',
      '12h',
    );
    this.jwtIssuer = this.config.get<string>('JWT_ISSUER', 'le-monde-de-lila');
    const audience = this.config.get<string>('JWT_AUDIENCE');
    this.jwtAudience =
      audience && audience.trim() ? audience.trim() : undefined;
  }

  private toAuthRuntimeConfig(config: ConfigService): AuthRuntimeConfig {
    const value = (key: string): string | null => {
      const normalized = String(config.get<string>(key) ?? '').trim();
      return normalized || null;
    };
    const tolerance = Number(config.get<number>('JWT_CLOCK_TOLERANCE_SECONDS'));
    return {
      jwtAlgorithm: value('JWT_ALGORITHM'),
      jwtSecret: value('JWT_SECRET'),
      jwtPrivateKeyPem: value('JWT_PRIVATE_KEY_PEM'),
      jwtPrivateKeyPath: value('JWT_PRIVATE_KEY_PATH'),
      jwtPublicKeyPem: value('JWT_PUBLIC_KEY_PEM'),
      jwtPublicKeyPath: value('JWT_PUBLIC_KEY_PATH'),
      jwtIssuer: value('JWT_ISSUER') ?? 'le-monde-de-lila',
      jwtAudience: value('JWT_AUDIENCE'),
      jwtClockToleranceSeconds:
        Number.isFinite(tolerance) && tolerance >= 0 ? tolerance : 10,
    };
  }

  sign(payload: UserTokenPayload): string {
    return jwt.sign(
      {
        username: payload.username,
        roles: payload.roles?.length ? payload.roles : ['ROLE_USER'],
        email: payload.email,
        id: payload.id,
      },
      this.jwtSigningKey,
      (() => {
        const options: jwt.SignOptions = {
          algorithm: this.jwtAlgorithm,
          expiresIn: this.jwtExpiresIn,
          issuer: this.jwtIssuer,
          subject: String(payload.id),
        };
        if (this.jwtAudience) {
          options.audience = this.jwtAudience;
        }
        return options;
      })(),
    );
  }
}
