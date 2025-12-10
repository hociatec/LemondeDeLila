import {
  Body,
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { HttpJwtGuard } from '../../common/guards/http-jwt.guard';
import { BotService } from '../services/bot.service';
import { BotAddedResponse, BotRemovedResponse } from '../../room/dto/room-response.dto';
import { RoomService } from '../../room/services/room.service';

@Controller('api/rooms/:roomId/bots')
@UseGuards(HttpJwtGuard)
export class BotController {
  constructor(
    private readonly bots: BotService,
    private readonly rooms: RoomService,
  ) {}

  @Post()
  async addBot(
    @Req() req: Request,
    @Param('roomId', ParseIntPipe) roomId: number,
    @Body('name') name?: string,
  ): Promise<BotAddedResponse> {
    const userId = this.requireUserId(req);
    const bot = await this.bots.addBot(roomId, userId, name);
    const payload = await this.rooms.getRoomPayload(roomId);
    return {
      type: 'bot.added',
      roomId,
      bot: { id: bot.id, name: bot.name },
      payload,
    };
  }

  @Delete(':botId')
  async removeBot(
    @Req() req: Request,
    @Param('roomId', ParseIntPipe) roomId: number,
    @Param('botId', ParseIntPipe) botId: number,
  ): Promise<BotRemovedResponse> {
    const userId = this.requireUserId(req);
    const bot = await this.bots.removeBot(roomId, userId, botId);
    const payload = await this.rooms.getRoomPayload(roomId);
    return {
      type: 'bot.removed',
      roomId,
      botId,
      bot: { id: bot.id, name: bot.name },
      payload,
    };
  }

  private requireUserId(req: Request): number {
    const userId = (req as any)?.user?.id;
    if (!userId || Number.isNaN(Number(userId))) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    return Number(userId);
  }
}
