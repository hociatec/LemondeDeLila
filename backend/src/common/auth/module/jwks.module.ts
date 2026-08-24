import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwksDocumentService } from '../application/services/jwks-document.service';
import { JWKS_CORE_PROVIDERS } from './jwks.module.providers.core';
import { JWKS_CONTROLLERS } from './jwks.module.providers.presentation';

@Module({
  imports: [ConfigModule],
  controllers: JWKS_CONTROLLERS,
  providers: JWKS_CORE_PROVIDERS,
  exports: [JwksDocumentService],
})
export class JwksModule {}
