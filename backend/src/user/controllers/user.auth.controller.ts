import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { UserAuthService } from '../services/user.auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';

@Controller('api')
export class UserAuthController {
  constructor(private readonly auth: UserAuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    await this.auth.register(body.email, body.username, body.password);
    return { message: 'User registered' };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: LoginDto) {
    return this.auth.login(body.username, body.password);
  }
}
