import { MESSAGING_USER_READER } from '../application/ports/messaging-user.repository';
import { PRIVATE_MESSAGE_REPOSITORY } from '../application/ports/private-message.repository';
import { MessageValidatorService } from '../application/services/message-validator.service';
import { MessagePresenterService } from '../application/services/message-presenter.service';
import { PrivateMessagingService } from '../application/services/private-messaging.service';
import { MessagingUserTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/messaging-user-typeorm.repository';
import { PrivateMessageTypeormRepository } from '../infrastructure/persistence/typeorm/repositories/private-message-typeorm.repository';

export const MESSAGING_CORE_PROVIDERS = [
  PrivateMessageTypeormRepository,
  MessagingUserTypeormRepository,
  {
    provide: PRIVATE_MESSAGE_REPOSITORY,
    useExisting: PrivateMessageTypeormRepository,
  },
  {
    provide: MESSAGING_USER_READER,
    useExisting: MessagingUserTypeormRepository,
  },
  PrivateMessagingService,
  MessageValidatorService,
  MessagePresenterService,
];
