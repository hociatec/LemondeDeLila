import { Injectable } from '@nestjs/common';
import {
  DEFAULT_MESSAGE_MAX_LENGTH,
  sanitizeMessage,
} from '../../../../common/utils/public-api';
import {
  ChatMessageRequiredError,
  ChatMessageTooLongError,
} from '../../../domain/errors/chat-domain.errors';

@Injectable()
export class ChatValidator {
  validate(text: string): string {
    const sanitized = sanitizeMessage(text, {
      encodeHtml: false,
      collapseNewLines: true,
    });
    if (sanitized === '') {
      throw new ChatMessageRequiredError();
    }
    if (sanitized.length > DEFAULT_MESSAGE_MAX_LENGTH) {
      throw new ChatMessageTooLongError();
    }
    return sanitized;
  }
}
