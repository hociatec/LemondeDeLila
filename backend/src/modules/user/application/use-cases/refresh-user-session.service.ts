import {
  BUSINESS_CLOCK,
  type BusinessClock,
} from '../../../../shared/interfaces/public-api';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { bestEffort } from '../../../../platform/observability/public-api';
import { userBanStatus } from '../../domain/policies/user-ban.policy';
import { credentialVersion } from '../../../../platform/auth/public-api';
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
    @Inject(BUSINESS_CLOCK) private readonly clock: BusinessClock,
  ) {}

  async execute(refreshToken: string): Promise<{
    token: string;
    refreshToken: string;
    userId: number;
    username: string;
  }> {
    const session = await this.refreshTokens.inspect(refreshToken);
    if (!session) {
      throw new UnauthorizedException('Refresh token invalide ou expire');
    }

    const user = await this.users.findById(session.userId);
    if (
      !user?.password ||
      session.credentialVersion !== credentialVersion(user.password)
    ) {
      await this.refreshTokens.revoke(refreshToken);
      throw new UnauthorizedException('Session invalide');
    }

    const banStatus = userBanStatus(user.bannedUntil, this.clock.now());
    if (banStatus === 'expired') {
      user.bannedUntil = null;
      user.banReason = null;
      await bestEffort(
        this.users.save(user),
        `nettoyage du bannissement expiré user=${user.id}`,
      );
    }
    if (banStatus === 'active' || banStatus === 'invalid') {
      await this.refreshTokens.revoke(refreshToken);
      throw new UnauthorizedException('Compte banni');
    }

    const token = this.tokenService.sign({
      id: user.id,
      email: user.email,
      roles: user.roles?.length ? user.roles : ['ROLE_USER'],
      username: user.username,
      credentialVersion: session.credentialVersion,
    });
    // Do not consume the client's token until account lookup and signing succeed.
    const rotation = await this.refreshTokens.rotate(refreshToken);
    if (
      !rotation ||
      rotation.userId !== user.id ||
      rotation.credentialVersion !== session.credentialVersion
    ) {
      throw new UnauthorizedException('Refresh token invalide ou expire');
    }
    return {
      token,
      refreshToken: rotation.refreshToken,
      userId: user.id,
      username: user.username,
    };
  }
}
