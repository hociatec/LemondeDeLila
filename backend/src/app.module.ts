import { Module } from '@nestjs/common';
import { AppCapabilitiesModule } from './app/boundaries/app-capabilities.module';
import { AppPlatformModule } from './app/boundaries/app-platform.module';

@Module({
  imports: [AppPlatformModule, AppCapabilitiesModule],
})
export class AppModule {}
