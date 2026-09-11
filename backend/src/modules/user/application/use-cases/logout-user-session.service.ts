import { Inject, Injectable } from '@nestjs/common';
import {
  REFRESH_TOKEN_SERVICE,
  type RefreshTokenServicePort,
} from '../ports/refresh-token.port';

@Injectable()
export class LogoutUserSessionService {
  constructor(
    @Inject(REFRESH_TOKEN_SERVICE)
    private readonly refreshTokens: RefreshTokenServicePort,
  ) {}

  async execute(
    refreshToken: string,
    userId?: number,
    allSessions = false,
  ): Promise<void> {
    if (allSessions) {
      if (!userId || !this.refreshTokens.revokeAllForUser) {
        throw new Error('Logout global indisponible sans session authentifiee');
      }
      await this.refreshTokens.revokeAllForUser(userId);
      return;
    }
    await this.refreshTokens.revoke(refreshToken);
  }
}
