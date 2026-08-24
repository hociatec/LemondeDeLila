import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import type {
  UserTokenPayload,
  UserTokenServicePort,
} from '../../application/ports/user-token.port';
import {
  getJwtAlgorithm,
  requireJwtSigningKey,
} from '../../../common/auth/application/services/jwt-config';

@Injectable()
export class JwtUserTokenService implements UserTokenServicePort {
  private readonly jwtSigningKey: string;
  private readonly jwtAlgorithm: jwt.Algorithm;
  private readonly jwtExpiresIn: jwt.SignOptions['expiresIn'];
  private readonly jwtIssuer: string;
  private readonly jwtAudience: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.jwtSigningKey = requireJwtSigningKey(this.config);
    this.jwtAlgorithm = getJwtAlgorithm(this.config);
    this.jwtExpiresIn = this.config.get<jwt.SignOptions['expiresIn']>(
      'JWT_EXPIRES_IN',
      '12h',
    );
    this.jwtIssuer = this.config.get<string>('JWT_ISSUER', 'le-monde-de-lila');
    const audience = this.config.get<string>('JWT_AUDIENCE');
    this.jwtAudience = audience && audience.trim() ? audience.trim() : undefined;
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
