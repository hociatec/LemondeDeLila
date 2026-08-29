import { Injectable } from '@nestjs/common';
import { LoginUserService } from '../../../application/use-cases/login-user.service';
import { RegisterUserService } from '../../../application/use-cases/register-user.service';
import { PayloadValidationService } from '../../../../../platform/validation/public-api';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { WS_EVENTS } from '../../../../../platform/realtime/public-api';
import { RefreshUserSessionService } from '../../../application/use-cases/refresh-user-session.service';
import { LogoutUserSessionService } from '../../../application/use-cases/logout-user-session.service';

@Injectable()
export class AuthWsHandler {
  constructor(
    private readonly loginUser: LoginUserService,
    private readonly refreshUserSession: RefreshUserSessionService,
    private readonly logoutUserSession: LogoutUserSessionService,
    private readonly registerUser: RegisterUserService,
    private readonly validator: PayloadValidationService,
  ) {}

  async register(payload: unknown) {
    const dto = this.validator.validate(RegisterDto, payload);
    await this.registerUser.execute(dto);
    return { type: WS_EVENTS.auth.registerOk, payload: { message: 'inscrit' } };
  }

  async login(payload: unknown) {
    const dto = this.validator.validate(LoginDto, payload);
    const result = await this.loginUser.execute(dto);
    return { type: WS_EVENTS.auth.loginOk, payload: result };
  }

  async refresh(payload: unknown) {
    const dto = this.validator.validate(RefreshTokenDto, payload);
    const result = await this.refreshUserSession.execute(dto.refreshToken);
    return { type: WS_EVENTS.auth.refreshOk, payload: result };
  }

  async logout(payload: unknown) {
    const dto = this.validator.validate(RefreshTokenDto, payload);
    await this.logoutUserSession.execute(dto.refreshToken);
    return { type: WS_EVENTS.auth.logoutOk, payload: { revoked: true } };
  }
}
