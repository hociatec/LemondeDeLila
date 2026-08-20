import { Module } from '@nestjs/common';
import {
  CHAT_MODULE_EXPORTS,
  CHAT_MODULE_IMPORTS,
  CHAT_MODULE_PROVIDERS,
} from './module/chat.module.definition';

@Module({
  imports: CHAT_MODULE_IMPORTS,
  providers: CHAT_MODULE_PROVIDERS,
  exports: CHAT_MODULE_EXPORTS,
})
export class ChatModule {}
