import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagingService } from './services/messaging.service';
import { MessageValidatorService } from './services/message-validator.service';
import { PrivateMessage } from './entities/private-message.entity';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PrivateMessage, User])],
  providers: [MessagingService, MessageValidatorService],
  exports: [MessagingService],
})
export class MessagingModule {}
