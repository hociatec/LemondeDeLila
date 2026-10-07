import { Module } from '@nestjs/common';
import { AppCapabilitiesModule } from './app/boundaries/app-capabilities.module';
import { AppPlatformModule } from './app/boundaries/app-platform.module';
import { AppAuthAccountsModule } from './app/boundaries/app-auth-accounts.module';

@Module({
  imports: [AppPlatformModule, AppAuthAccountsModule, AppCapabilitiesModule],
})
export class AppModule {}
