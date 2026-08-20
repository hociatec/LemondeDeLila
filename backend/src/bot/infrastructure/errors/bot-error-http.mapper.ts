import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { BotApplicationError } from '../../application/errors/bot-application.errors';

export function mapBotApplicationError(error: unknown): unknown {
  if (!(error instanceof BotApplicationError)) {
    return error;
  }

  switch (error.code) {
    case 'BOT_ROOM_NOT_FOUND':
    case 'BOT_NOT_FOUND':
      return new NotFoundException(error.message);
    case 'BOT_ROOM_OWNER_REQUIRED':
      return new UnauthorizedException(error.message);
    case 'BOT_NAME_REQUIRED':
    case 'BOT_NAME_ALREADY_USED':
    case 'BOT_UNAVAILABLE_NAMES':
    case 'BOT_ROOM_ALREADY_STARTED':
    case 'BOT_ROOM_FULL':
    case 'BOT_MINIMUM_PARTICIPANTS':
      return new BadRequestException(error.message);
    default:
      return new BadRequestException(error.message);
  }
}
