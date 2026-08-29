import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { bestEffort } from '../../../common/utils/public-api';
import {
  REFRESH_TOKEN_SERVICE,
  type RefreshTokenServicePort,
} from '../ports/refresh-token.port';
import { USER_REPOSITORY, type UserRepository } from '../ports/user.repository';
import {
  USER_TOKEN_SERVICE,
  type UserTokenServicePort,
} from '../ports/user-token.port';

@Injectable()
export class RefreshUserSessionService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(USER_TOKEN_SERVICE)
    private readonly tokenService: UserTokenServicePort,
    @Inject(REFRESH_TOKEN_SERVICE)
    private readonly refreshTokens: RefreshTokenServicePort,
  ) {}

  async execute(refreshToken: string): Promise<{
    token: string;
    refreshToken: string;
    userId: number;
    username: string;
  }> {
    const rotation = await this.refreshTokens.rotate(refreshToken);
    if (!rotation) {
      throw new UnauthorizedException('Refresh token invalide ou expire');
    }

    const user = await this.users.findById(rotation.userId);
    if (!user) {
      await this.refreshTokens.revoke(rotation.refreshToken);
      throw new UnauthorizedException('Session invalide');
    }

    if (user.bannedUntil && user.bannedUntil.getTime() <= Date.now()) {
      user.bannedUntil = null;
      user.banReason = null;
      await bestEffort(
        this.users.save(user),
        `nettoyage du bannissement expiré user=${user.id}`,
      );
    }
    if (user.bannedUntil && user.bannedUntil.getTime() > Date.now()) {
      await this.refreshTokens.revoke(rotation.refreshToken);
      throw new UnauthorizedException('Compte banni');
    }

    const token = this.tokenService.sign({
      id: user.id,
      email: user.email,
      roles: user.roles?.length ? user.roles : ['ROLE_USER'],
      username: user.username,
    });
    return {
      token,
      refreshToken: rotation.refreshToken,
      userId: user.id,
      username: user.username,
    };
  }
}
