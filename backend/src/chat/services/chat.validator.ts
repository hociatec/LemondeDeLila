import { Injectable } from '@nestjs/common';
import {
  DEFAULT_MESSAGE_MAX_LENGTH,
  sanitizeMessage,
} from '../../common/utils/message-sanitizer';

@Injectable()
export class ChatValidator {
  validate(text: string): string {
    const sanitized = sanitizeMessage(text, {
      encodeHtml: false,
      collapseNewLines: true,
    });
    if (sanitized === '') {
      throw new Error('MESSAGE_REQUIRED');
    }
    if (sanitized.length > DEFAULT_MESSAGE_MAX_LENGTH) {
      throw new Error('MESSAGE_TOO_LONG');
    }
    return sanitized;
  }
}
