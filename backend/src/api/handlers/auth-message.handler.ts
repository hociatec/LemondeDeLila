import { Injectable } from '@nestjs/common';
import { UserAuthService } from '../../user/services/user.auth.service';
import { PayloadValidationService } from '../services/payload-validation.service';
import { AuthRegisterDto } from '../dto/auth-register.dto';
import { AuthLoginDto } from '../dto/auth-login.dto';

@Injectable()
export class AuthMessageHandler {
  constructor(
    private readonly auth: UserAuthService,
    private readonly validator: PayloadValidationService,
  ) {}

  async register(payload: any) {
    const dto = this.validator.validate(AuthRegisterDto, payload);
    await this.auth.register(dto.email, dto.username, dto.password);
    return { type: 'auth.register.ok', payload: { message: 'inscrit' } };
  }

  async login(payload: any) {
    const dto = this.validator.validate(AuthLoginDto, payload);
    const result = await this.auth.login(dto.username, dto.password);
    return { type: 'auth.login.ok', payload: result };
  }
}
