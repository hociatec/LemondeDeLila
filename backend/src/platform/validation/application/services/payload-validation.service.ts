import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { BadRequestException, Injectable } from '@nestjs/common';
import { normalizeInputStrings } from './input-normalization';

@Injectable()
export class PayloadValidationService {
  validate<T>(cls: new () => T, payload: unknown): T {
    const instance = plainToInstance(
      cls,
      normalizeInputStrings(payload ?? {}),
      {
        enableImplicitConversion: true,
      },
    );
    const errors = validateSync(instance as object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false },
    });
    if (errors.length > 0) {
      const messages = errors
        .map((e) => Object.values(e.constraints ?? {}))
        .flat()
        .filter(Boolean);
      throw new BadRequestException(messages.join(', ') || 'Payload invalide');
    }
    return instance;
  }
}
