import {
  BotMinimumParticipantsError,
  BotRoomAlreadyStartedError,
  BotRoomFullError,
  BotRoomNotFoundError,
  BotRoomOwnerRequiredError,
} from '../../errors/bot-application.errors';
import type { BotMutationDecision } from '../../models/bot-mutation.model';

/** Translates the owning domain's decision into the Bot error contract. */
export class BotRoomPolicyService {
  requireAllowed(decision: BotMutationDecision): void {
    switch (decision) {
      case 'allowed':
        return;
      case 'room-not-found':
        throw new BotRoomNotFoundError();
      case 'owner-required':
        throw new BotRoomOwnerRequiredError();
      case 'room-started':
        throw new BotRoomAlreadyStartedError();
      case 'room-full':
        throw new BotRoomFullError();
      case 'minimum-participants':
        throw new BotMinimumParticipantsError();
      default:
        throw new Error('Unknown room bot mutation decision');
    }
  }
}
