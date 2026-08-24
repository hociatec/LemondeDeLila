import { Injectable } from '@nestjs/common';
import { LoginUserService } from '../../../application/use-cases/login-user.service';
import { RegisterUserService } from '../../../application/use-cases/register-user.service';
import { PayloadValidationService } from '../../../../common/validation/public-api';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { WS_EVENTS } from '../../../../realtime/public-api';

@Injectable()
export class AuthWsHandler {
  constructor(
    private readonly loginUser: LoginUserService,
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
}

