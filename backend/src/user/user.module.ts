import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserService } from './services/user.service';
import { UserAuthService } from './services/user.auth.service';
import { AuthWsHandler } from './ws/auth-ws.handler';
import { UserWsHandler } from './ws/user-ws.handler';
import { UserWsRegistrar } from './ws/user-ws.registrar';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [
    UserService,
    UserAuthService,
    AuthWsHandler,
    UserWsHandler,
    UserWsRegistrar,
  ],
  exports: [UserService, UserAuthService],
})
export class UserModule {}
