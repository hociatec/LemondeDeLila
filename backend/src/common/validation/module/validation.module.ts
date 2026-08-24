import { Global, Module } from '@nestjs/common';
import { PayloadValidationService } from '../application/services/payload-validation.service';
import { VALIDATION_CORE_PROVIDERS } from './validation.module.providers.core';

@Global()
@Module({
  providers: VALIDATION_CORE_PROVIDERS,
  exports: [PayloadValidationService],
})
export class ValidationModule {}
