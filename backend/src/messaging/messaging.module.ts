import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagingService } from './services/messaging.service';
import { MessageValidatorService } from './services/message-validator.service';
import { PrivateMessage } from './entities/private-message.entity';
import { User } from '../user/entities/user.entity';
import { MessagingWsHandler } from './ws/messaging-ws.handler';
import { MessagingWsRegistrar } from './ws/messaging-ws.registrar';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [TypeOrmModule.forFeature([PrivateMessage, User]), NotificationModule],
  providers: [
    MessagingService,
    MessageValidatorService,
    MessagingWsHandler,
    MessagingWsRegistrar,
  ],
  exports: [MessagingService],
})
export class MessagingModule {}
