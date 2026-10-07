import { Global, Module } from '@nestjs/common';
import { AUTH_ACCOUNT_READER } from '../../platform/auth/public-api';
import { UserModule } from '../../modules/user/composition-api';
import { USER_ADMINISTRATION_PORT } from '../../modules/user/public-api';

@Global()
@Module({
  imports: [UserModule],
  providers: [
    { provide: AUTH_ACCOUNT_READER, useExisting: USER_ADMINISTRATION_PORT },
  ],
  exports: [AUTH_ACCOUNT_READER],
})
export class AppAuthAccountsModule {}
