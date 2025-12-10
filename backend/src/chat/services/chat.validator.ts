import { Injectable } from '@nestjs/common';

@Injectable()
export class ChatValidator {
  private static readonly MAX_LENGTH = 1000;

  validate(text: string): string {
    let sanitized = (text ?? '').trim();
    if (sanitized === '') {
      throw new Error('MESSAGE_REQUIRED');
    }
    if (sanitized.length > ChatValidator.MAX_LENGTH) {
      throw new Error('MESSAGE_TOO_LONG');
    }
    sanitized = sanitized.replace(/<[^>]*>?/gm, '');
    sanitized = sanitized.replace(/[\r\n]+/g, ' ').trim();
    return sanitized;
  }
}
