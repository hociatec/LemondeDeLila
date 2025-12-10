import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { RoomService } from '../services/room.service';
import { CreateRoomDto } from '../dto/create-room.dto';
import { HttpJwtGuard } from '../../common/guards/http-jwt.guard';
import type { Request } from 'express';
import {
  RoomCreatedResponse,
  RoomJoinedResponse,
  RoomLeftResponse,
  RoomStartedResponse,
} from '../dto/room-response.dto';

@Controller('api/rooms')
@UseGuards(HttpJwtGuard)
export class RoomController {
  constructor(private readonly rooms: RoomService) {}

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateRoomDto): Promise<RoomCreatedResponse> {
    const userId = this.requireUserId(req);
    const room = await this.rooms.createRoom(
      userId,
      dto.gameType,
      dto.name,
      dto.maxPlayers,
      dto.isPrivate ?? false,
    );
    const payload = await this.rooms.getRoomPayload(room.id);
    return { type: 'room.created', roomId: room.id, payload };
  }

  @Post(':id/join')
  async join(
    @Req() req: Request,
    @Param('id', ParseIntPipe) roomId: number,
  ): Promise<RoomJoinedResponse> {
    const userId = this.requireUserId(req);
    await this.rooms.joinRoom(roomId, userId);
    const payload = await this.rooms.getRoomPayload(roomId);
    return { type: 'room.joined', roomId, payload };
  }

  @Post(':id/leave')
  async leave(
    @Req() req: Request,
    @Param('id', ParseIntPipe) roomId: number,
  ): Promise<RoomLeftResponse> {
    const userId = this.requireUserId(req);
    const room = await this.rooms.leaveRoom(roomId, userId);
    if (!room) {
      return { type: 'room.deleted', roomId };
    }
    const payload = await this.rooms.getRoomPayload(roomId);
    return { type: 'room.left', roomId, payload };
  }

  @Post(':id/start')
  async start(
    @Req() req: Request,
    @Param('id', ParseIntPipe) roomId: number,
  ): Promise<RoomStartedResponse> {
    const userId = this.requireUserId(req);
    await this.rooms.startRoom(roomId, userId);
    const payload = await this.rooms.getRoomPayload(roomId);
    return { type: 'room.started', roomId, payload };
  }

  private requireUserId(req: Request): number {
    const userId = (req as any)?.user?.id;
    if (!userId || Number.isNaN(Number(userId))) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    return Number(userId);
  }
}
