import { Injectable } from '@nestjs/common';
import { UserAuthService } from '../services/user.auth.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { WS_EVENTS } from '../../common/ws/ws-events';

@Injectable()
export class AuthWsHandler {
  constructor(
    private readonly auth: UserAuthService,
    private readonly validator: PayloadValidationService,
  ) {}

  async register(payload: unknown) {
    const dto = this.validator.validate(RegisterDto, payload);
    await this.auth.register(dto.email, dto.username, dto.password);
    return { type: WS_EVENTS.auth.registerOk, payload: { message: 'inscrit' } };
  }

  async login(payload: unknown) {
    const dto = this.validator.validate(LoginDto, payload);
    const result = await this.auth.login(dto.username, dto.password);
    return { type: WS_EVENTS.auth.loginOk, payload: result };
  }
}
