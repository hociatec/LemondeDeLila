import {
  ValidationPipe,
  type ArgumentMetadata,
  type ValidationPipeOptions,
} from '@nestjs/common';
import { normalizeInputStrings } from './input-normalization';

export class NormalizedValidationPipe extends ValidationPipe {
  constructor(options: ValidationPipeOptions = {}) {
    super(options);
  }

  override transform(value: unknown, metadata: ArgumentMetadata) {
    return super.transform(normalizeInputStrings(value), metadata);
  }
}
