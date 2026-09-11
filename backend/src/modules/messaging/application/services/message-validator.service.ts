import { Injectable, BadRequestException } from '@nestjs/common';
import {
  DEFAULT_MESSAGE_MAX_LENGTH,
  sanitizeMessage,
} from '../../../../shared/utils/public-api';

@Injectable()
export class MessageValidatorService {
  private static readonly SUBJECT_MAX_LENGTH = 200;

  validate(text: string): string {
    if (typeof text !== 'string' || text.length > 100_000) {
      throw new BadRequestException('Le message est invalide');
    }
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
    if (subject == null || typeof subject !== 'string') {
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
