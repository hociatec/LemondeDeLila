import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatService } from './services/chat.service';
import { ChatValidator } from './services/chat.validator';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ChatMessage, User])],
  providers: [ChatService, ChatValidator],
  exports: [ChatService, ChatValidator],
})
export class ChatModule {}
