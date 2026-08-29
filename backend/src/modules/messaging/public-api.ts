export { MessagingModule } from './module/messaging.module';
export { PrivateMessagingService } from './application/services/private-messaging.service';
export {
  PRIVATE_MESSAGE_REPOSITORY,
  type PrivateMessageRepository,
} from './application/ports/private-message.repository';
export { PrivateMessageTypeormRepository } from './infrastructure/persistence/typeorm/repositories/private-message-typeorm.repository';
