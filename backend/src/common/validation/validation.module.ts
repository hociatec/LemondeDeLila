import { Global, Module } from '@nestjs/common';
import { PayloadValidationService } from './payload-validation.service';

@Global()
@Module({
  providers: [PayloadValidationService],
  exports: [PayloadValidationService],
})
export class ValidationModule {}

