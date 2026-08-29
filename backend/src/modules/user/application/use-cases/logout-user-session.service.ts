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

  async execute(refreshToken: string): Promise<void> {
    await this.refreshTokens.revoke(refreshToken);
  }
}
