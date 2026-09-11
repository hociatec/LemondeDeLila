import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ApplicationShutdownService } from '../application/application-shutdown.service';
import { ShutdownHttpInterceptor } from '../infrastructure/shutdown-http.interceptor';

@Global()
@Module({
  providers: [
    ApplicationShutdownService,
    { provide: APP_INTERCEPTOR, useClass: ShutdownHttpInterceptor },
  ],
  exports: [ApplicationShutdownService],
})
export class LifecycleModule {}
