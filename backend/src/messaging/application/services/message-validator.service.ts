import { Injectable, BadRequestException } from '@nestjs/common';
import {
  DEFAULT_MESSAGE_MAX_LENGTH,
  sanitizeMessage,
} from '../../../common/utils/public-api';

@Injectable()
export class MessageValidatorService {
  private static readonly SUBJECT_MAX_LENGTH = 200;

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
        'Le message est trop long (max 1000 caractères)',
      );
    }
    return sanitized;
  }

  validateSubject(subject?: string | null): string | null {
    if (!subject) {
      return null;
    }
    const sanitized = sanitizeMessage(subject, {
      encodeHtml: true,
      collapseNewLines: true,
    }).trim();
    if (!sanitized) {
      return null;
    }
    if (sanitized.length > MessageValidatorService.SUBJECT_MAX_LENGTH) {
      throw new BadRequestException(
        `Le sujet est trop long (max ${MessageValidatorService.SUBJECT_MAX_LENGTH} caractères)`,
      );
    }
    return sanitized;
  }
}
