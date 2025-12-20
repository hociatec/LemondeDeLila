import { Injectable } from '@nestjs/common';
import { UserAuthService } from '../services/user.auth.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';

@Injectable()
export class AuthWsHandler {
  constructor(
    private readonly auth: UserAuthService,
    private readonly validator: PayloadValidationService,
  ) {}

  async register(payload: any) {
    const dto = this.validator.validate(RegisterDto, payload);
    await this.auth.register(dto.email, dto.username, dto.password);
    return { type: 'auth.register.ok', payload: { message: 'inscrit' } };
  }

  async login(payload: any) {
    const dto = this.validator.validate(LoginDto, payload);
    const result = await this.auth.login(dto.username, dto.password);
    return { type: 'auth.login.ok', payload: result };
  }
}
