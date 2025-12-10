import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class MessageValidatorService {
  private static readonly MAX_LENGTH = 1000;

  validate(text: string): string {
    const trimmed = (text ?? '').trim();
    if (!trimmed) {
      throw new BadRequestException('Le message est requis');
    }
    if (trimmed.length > MessageValidatorService.MAX_LENGTH) {
      throw new BadRequestException('Le message est trop long (max 1000 caracteres)');
    }
    const sanitized = this.sanitize(trimmed);
    if (!sanitized) {
      throw new BadRequestException('Le message est requis');
    }
    return sanitized;
  }

  private sanitize(text: string): string {
    const noTags = text.replace(/<[^>]*>/g, '');
    const encoded = noTags.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return encoded;
  }
}
