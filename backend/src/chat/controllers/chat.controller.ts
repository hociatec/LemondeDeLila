import { Controller, Get, Query } from '@nestjs/common';
import { ChatService } from '../services/chat.service';

@Controller('api/chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('messages')
  async getMessages(
    @Query('limit') limit?: string,
    @Query('since') since?: string,
  ) {
    const parsedLimit = parseInt(limit ?? '200', 10);
    const limitSafe = isNaN(parsedLimit) ? 200 : parsedLimit;
    const sinceDate = since ? new Date(since) : undefined;
    const messages = await this.chat.getRecentMessages(limitSafe, sinceDate);
    return this.chat.normalizeMany(messages);
  }
}
