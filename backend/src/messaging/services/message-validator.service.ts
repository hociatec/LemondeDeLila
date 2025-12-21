import { Injectable, BadRequestException } from '@nestjs/common';
import {
  DEFAULT_MESSAGE_MAX_LENGTH,
  sanitizeMessage,
} from '../../common/utils/message-sanitizer';

@Injectable()
export class MessageValidatorService {
  validate(text: string): string {
    const sanitized = sanitizeMessage(text, {
      encodeHtml: true,
      collapseNewLines: true,
    });
    if (!sanitized) {
      throw new BadRequestException('Le message est requis');
    }
    if (sanitized.length > DEFAULT_MESSAGE_MAX_LENGTH) {
      throw new BadRequestException(
        'Le message est trop long (max 1000 caracteres)',
      );
    }
    return sanitized;
  }
}
