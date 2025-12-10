import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { HttpJwtGuard } from '../../common/guards/http-jwt.guard';
import { MessagingService } from '../services/messaging.service';
import { SendMessageDto } from '../dto/send-message.dto';
import { MessageDto } from '../services/messaging.service';
import type { Request } from 'express';

type MessagesResponse = { items: MessageDto[] };
type MessageResponse = { message: MessageDto };
type UserLookupResponse = { user: { id: number; username: string } | null };
type AuthUser = { id: number; username?: string; email?: string; roles?: string[] };

@Controller('api/messaging')
@UseGuards(HttpJwtGuard)
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get('conversations/:userId')
  async conversation(
    @Req() req: Request,
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ): Promise<MessagesResponse> {
    const current = this.requireUser(req);
    const targetId = Number(userId);
    const parsedLimit = this.parseLimit(limit);
    const items = await this.messaging.conversation(current.id, targetId, parsedLimit);
    return { items };
  }

  @Get('messages')
  async messages(
    @Req() req: Request,
    @Query('box') box = 'inbox',
    @Query('limit') limit?: string,
  ): Promise<{ box: string; items: MessageDto[] }> {
    const current = this.requireUser(req);
    const parsedLimit = this.parseLimit(limit);
    const { finalBox, items } = await this.resolveBox(box, current.id, parsedLimit);
    return { box: finalBox, items };
  }

  @Post('messages')
  async send(@Req() req: Request, @Body() payload: SendMessageDto): Promise<MessageResponse> {
    const current = this.requireUser(req);
    const message = await this.messaging.send(current.id, payload);
    return { message };
  }

  @Delete('messages/:messageId')
  async delete(@Req() req: Request, @Param('messageId') messageId: string): Promise<MessageResponse> {
    const current = this.requireUser(req);
    const message = await this.messaging.delete(current.id, messageId);
    return { message };
  }

  @Post('messages/:messageId/restore')
  async restore(
    @Req() req: Request,
    @Param('messageId') messageId: string,
  ): Promise<MessageResponse> {
    const current = this.requireUser(req);
    const message = await this.messaging.restore(current.id, messageId);
    return { message };
  }

  @Get('users/search')
  async search(@Query('username') username: string): Promise<UserLookupResponse> {
    const user = await this.messaging.lookupUser(username ?? '');
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return { user };
  }

  private requireUser(req: Request): AuthUser {
    const user = (req as any).user;
    const id = typeof user?.id === 'string' ? Number(user.id) : user?.id;
    if (!user || !id || Number.isNaN(id)) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return { ...user, id };
  }

  private parseLimit(raw?: string): number {
    if (raw === undefined || raw === null || raw === '') {
      return 100;
    }
    const value = Number(raw);
    if (Number.isNaN(value) || value < 1) {
      throw new BadRequestException('Parametre limit invalide');
    }
    return value;
  }

  private async resolveBox(box: string, userId: number, limit: number): Promise<{ finalBox: string; items: MessageDto[] }> {
    const normalized = (box || 'inbox').toLowerCase();
    const mapping: Record<string, 'inbox' | 'outbox' | 'deleted'> = {
      inbox: 'inbox',
      received: 'inbox',
      '': 'inbox',
      sent: 'outbox',
      outbox: 'outbox',
      deleted: 'deleted',
      trash: 'deleted',
    };
    const target = mapping[normalized];
    if (!target) {
      throw new NotFoundException('Boite de messagerie inconnue');
    }
    const items =
      target === 'outbox'
        ? await this.messaging.outbox(userId, limit)
        : target === 'deleted'
          ? await this.messaging.deleted(userId, limit)
          : await this.messaging.inbox(userId, limit);
    const finalBox = normalized === '' ? 'inbox' : normalized === 'sent' ? 'outbox' : normalized;
    return { finalBox, items };
  }
}
