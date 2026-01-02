import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatSettingsEntity } from './entities/chat-settings.entity';
import { ChatService } from './services/chat.service';
import { ChatSettingsService } from './services/chat-settings.service';
import { ChatValidator } from './services/chat.validator';

@Module({
  imports: [TypeOrmModule.forFeature([ChatMessage, ChatSettingsEntity])],
  providers: [ChatService, ChatSettingsService, ChatValidator],
  exports: [ChatService, ChatSettingsService, ChatValidator],
})
export class ChatModule {}
