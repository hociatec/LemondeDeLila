import { PASSWORD_HASHER } from '../application/ports/password-hasher.port';
import { USER_REPOSITORY } from '../application/ports/user.repository';
import { STAFF_USERS_READER } from '../application/ports/staff-users-reader.port';
import { StaffUsersTypeormReader } from '../infrastructure/persistence/typeorm/repositories/staff-users-typeorm.reader';
import { USER_ADMINISTRATION_PORT } from '../application/ports/user-administration.port';
import { USER_TOKEN_SERVICE } from '../application/ports/user-token.port';
import { GetUserService } from '../application/use-cases/get-user.service';
import { ListUsersService } from '../application/use-cases/list-users.service';
import { LoginUserService } from '../application/use-cases/login-user.service';
import { RegisterUserService } from '../application/use-cases/register-user.service';
import { RefreshUserSessionService } from '../application/use-cases/refresh-user-session.service';
import { LogoutUserSessionService } from '../application/use-cases/logout-user-session.service';
import { REFRESH_TOKEN_SERVICE } from '../application/ports/refresh-token.port';
import { UserTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/user-typeorm.repository';
import { UserAdministrationTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/user-administration-typeorm.repository';
import { BcryptPasswordHasherService } from '../infrastructure/security/bcrypt-password-hasher.service';
import { JwtUserTokenService } from '../infrastructure/security/jwt-user-token.service';
import { RedisRefreshTokenService } from '../infrastructure/security/redis-refresh-token.service';

export const USER_CORE_PROVIDERS = [
  StaffUsersTypeormReader,
  { provide: STAFF_USERS_READER, useExisting: StaffUsersTypeormReader },
  UserTypeormRepository,
  UserAdministrationTypeormRepository,
  BcryptPasswordHasherService,
  JwtUserTokenService,
  RedisRefreshTokenService,
  {
    provide: USER_REPOSITORY,
    useExisting: UserTypeormRepository,
  },
  {
    provide: USER_ADMINISTRATION_PORT,
    useExisting: UserAdministrationTypeormRepository,
  },
  {
    provide: PASSWORD_HASHER,
    useExisting: BcryptPasswordHasherService,
  },
  {
    provide: USER_TOKEN_SERVICE,
    useExisting: JwtUserTokenService,
  },
  {
    provide: REFRESH_TOKEN_SERVICE,
    useExisting: RedisRefreshTokenService,
  },
  GetUserService,
  ListUsersService,
  LoginUserService,
  LogoutUserSessionService,
  RefreshUserSessionService,
  RegisterUserService,
];
