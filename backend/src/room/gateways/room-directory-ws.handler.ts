import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { requireUser } from '../../common/ws/ws-auth';
import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { NotificationService } from '../../notification/services/notification.service';
import { Room } from '../entities/room.entity';
import { RoomParticipant } from '../entities/room-participant.entity';
import { RoomsPublicJoinDto, RoomsPublicListDto } from '../dto/rooms-public.dto';
import { RoomInviteRespondDto, RoomInviteSendDto } from '../dto/room-invite.dto';
import { RoomService } from '../services/room.service';
import { RoomInviteService } from '../services/room-invite.service';
import { OPEN_ROOM_STATUSES } from '../constants/room-status.constants';

@Injectable()
export class RoomDirectoryWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly rooms: RoomService,
    private readonly invites: RoomInviteService,
    private readonly notifications: NotificationService,
    @InjectRepository(Room) private readonly roomRepo: Repository<Room>,
    @InjectRepository(RoomParticipant) private readonly participantRepo: Repository<RoomParticipant>,
  ) {}

  async listPublic(session: WsSession, payload: any) {
    requireUser(session);
    const dto = this.validator.validate(RoomsPublicListDto, payload);
    const statuses = OPEN_ROOM_STATUSES.map((s) => s.toLowerCase());
    const qb = this.roomRepo
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.owner', 'owner')
      .leftJoinAndSelect('room.participants', 'participant', 'participant.leftAt IS NULL')
      .leftJoinAndSelect('participant.user', 'participantUser')
      .leftJoinAndSelect('room.bots', 'bot')
      .where('room.isPrivate = :isPrivate', { isPrivate: false })
      .andWhere('LOWER(room.status) IN (:...statuses)', { statuses });
    if (dto.gameType) {
      qb.andWhere('room.gameType = :gameType', { gameType: dto.gameType });
    }
    const rooms = await qb.getMany();
    const items = rooms.map((r) => ({
      id: r.id,
      name: r.name,
      gameType: r.gameType,
      status: r.status,
      maxPlayers: r.maxPlayers,
      playersCount: (r.participants || []).filter((p) => !p.leftAt).length,
      botsCount: (r.bots || []).length,
      owner: r.owner ? { id: r.owner.id, username: r.owner.username } : null,
    }));

    // Group server-side by gameType to match the expected plan, while keeping `items` for compatibility.
    const grouped = new Map<string, typeof items>();
    for (const item of items) {
      const key = item.gameType || '';
      const existing = grouped.get(key);
      if (existing) {
        existing.push(item);
      } else {
        grouped.set(key, [item]);
      }
    }
    const groups = Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map(([gameType, rooms]) => ({ gameType, rooms }));

    return { type: 'rooms.public.listed', payload: { items, groups } };
  }

  async joinPublic(session: WsSession, payload: any) {
    const user = requireUser(session);
    const dto = this.validator.validate(RoomsPublicJoinDto, payload);
    await this.rooms.joinRoom(dto.roomId, user.id);
    const state = await this.rooms.getRoomPayload(dto.roomId);
    return { type: 'rooms.public.joined', payload: { roomId: dto.roomId, room: state.room } };
  }

  async inviteSend(session: WsSession, payload: any) {
    const user = requireUser(session);
    const dto = this.validator.validate(RoomInviteSendDto, payload);
    const room = await this.roomRepo.findOne({ where: { id: dto.roomId }, relations: ['owner'] });
    if (!room) {
      throw new NotFoundException('Table introuvable');
    }
    if (!room.owner || room.owner.id !== user.id) {
      throw new ForbiddenException('Seul le propriétaire peut inviter');
    }
    if (!room.isPrivate) {
      throw new ForbiddenException('Invitation réservée aux tables privées');
    }
    const existingParticipant = await this.participantRepo.findOne({
      where: { room: { id: room.id }, user: { id: dto.userId }, leftAt: IsNull() },
    });
    if (existingParticipant) {
      return { type: 'rooms.invite.sent', payload: { roomId: room.id, userId: dto.userId, alreadyInRoom: true } };
    }
    const existingInvite = this.invites.findActive(room.id, dto.userId);
    const invite = existingInvite ?? this.invites.create(room.id, user.id, dto.userId);
    this.notifications.notifyUser(dto.userId, 'rooms.invite.received', {
      invitationId: invite.id,
      room: { id: room.id, name: room.name, gameType: room.gameType, status: room.status, maxPlayers: room.maxPlayers },
      from: { id: user.id, username: user.username },
      expiresAt: invite.expiresAt,
    });
    return { type: 'rooms.invite.sent', payload: { invitationId: invite.id, roomId: room.id, userId: dto.userId } };
  }

  async inviteRespond(session: WsSession, payload: any) {
    const user = requireUser(session);
    const dto = this.validator.validate(RoomInviteRespondDto, payload);
    const invite = this.invites.get(dto.invitationId);
    if (!invite) {
      return { type: 'rooms.invite.responded', payload: { invitationId: dto.invitationId, accepted: false, expired: true } };
    }
    if (invite.toUserId !== user.id) {
      throw new ForbiddenException('Invitation non destinée à cet utilisateur');
    }
    if (!dto.accept) {
      this.invites.delete(dto.invitationId);
      this.notifications.notifyUser(invite.fromUserId, 'rooms.invite.responded', {
        invitationId: dto.invitationId,
        roomId: invite.roomId,
        accepted: false,
        by: { id: user.id, username: user.username },
      });
      return { type: 'rooms.invite.responded', payload: { invitationId: dto.invitationId, accepted: false } };
    }
    // accept: join first, then consume the invitation (one-shot) only on success
    await this.rooms.joinRoom(invite.roomId, user.id, { allowPrivate: true });
    this.invites.consume(dto.invitationId);
    const state = await this.rooms.getRoomPayload(invite.roomId);
    this.notifications.notifyUser(invite.fromUserId, 'rooms.invite.responded', {
      invitationId: dto.invitationId,
      roomId: invite.roomId,
      accepted: true,
      by: { id: user.id, username: user.username },
    });
    return { type: 'rooms.invite.accepted', payload: { roomId: invite.roomId, room: state.room } };
  }
}
