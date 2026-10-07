import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import type {
  UserTokenPayload,
  UserTokenServicePort,
} from '../../application/ports/user-token.port';
import {
  type AuthRuntimeConfig,
  requireJwtSigningKey,
} from '../../../../platform/auth/public-api';

@Injectable()
export class JwtUserTokenService implements UserTokenServicePort {
  private static readonly MAX_ISSUER_LENGTH = 128;
  private static readonly MAX_AUDIENCE_LENGTH = 128;
  private static readonly MAX_USERNAME_LENGTH = 255;
  private static readonly MAX_EMAIL_LENGTH = 320;
  private static readonly MAX_ROLE_LENGTH = 64;
  private static readonly MAX_ROLES = 32;
  private readonly jwtSigningKey: string;
  private readonly jwtExpiresIn: jwt.SignOptions['expiresIn'];
  private readonly jwtIssuer: string;
  private readonly jwtAudience: string | undefined;

  constructor(private readonly config: ConfigService) {
    const authConfig = this.toAuthRuntimeConfig(config);
    this.jwtSigningKey = requireJwtSigningKey(authConfig);
    this.jwtExpiresIn = this.config.get<jwt.SignOptions['expiresIn']>(
      'JWT_EXPIRES_IN',
      '12h',
    );
    this.jwtIssuer = String(
      this.config.get<string>('JWT_ISSUER', 'le-monde-de-lila'),
    )
      .trim()
      .slice(0, JwtUserTokenService.MAX_ISSUER_LENGTH);
    const audience = this.config.get<string>('JWT_AUDIENCE');
    this.jwtAudience =
      audience && audience.trim()
        ? audience.trim().slice(0, JwtUserTokenService.MAX_AUDIENCE_LENGTH)
        : undefined;
  }

  private toAuthRuntimeConfig(config: ConfigService): AuthRuntimeConfig {
    const value = (key: string): string | null => {
      const normalized = String(config.get<string>(key) ?? '').trim();
      return normalized || null;
    };
    const tolerance = Number(config.get<number>('JWT_CLOCK_TOLERANCE_SECONDS'));
    return {
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
    if (!Number.isSafeInteger(payload.id) || payload.id <= 0) {
      throw new UnauthorizedException('Identifiant utilisateur invalide');
    }
    if (
      typeof payload.username !== 'string' ||
      payload.username.length > JwtUserTokenService.MAX_USERNAME_LENGTH
    ) {
      throw new UnauthorizedException('Nom utilisateur invalide');
    }
    if (
      payload.email !== undefined &&
      (typeof payload.email !== 'string' ||
        payload.email.length > JwtUserTokenService.MAX_EMAIL_LENGTH)
    ) {
      throw new UnauthorizedException('Adresse email invalide');
    }
    const roles = payload.roles?.length ? payload.roles : ['ROLE_USER'];
    if (
      !Array.isArray(roles) ||
      roles.length > JwtUserTokenService.MAX_ROLES ||
      roles.some(
        (role) =>
          typeof role !== 'string' ||
          role.length === 0 ||
          role.length > JwtUserTokenService.MAX_ROLE_LENGTH,
      )
    ) {
      throw new UnauthorizedException('Roles invalides');
    }
    return jwt.sign(
      {
        username: payload.username,
        roles,
        email: payload.email,
        id: payload.id,
      },
      this.jwtSigningKey,
      (() => {
        const options: jwt.SignOptions = {
          algorithm: 'RS256',
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
