import { Module } from '@nestjs/common';
import { AppCapabilitiesModule } from './app-capabilities.module';
import { AppPlatformModule } from './app-platform.module';

@Module({
  imports: [AppPlatformModule, AppCapabilitiesModule],
})
export class AppModule {}
