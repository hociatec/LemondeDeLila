import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Room } from '../entities/room.entity';
import { RoomParticipant } from '../entities/room-participant.entity';
import { User } from '../../user/entities/user.entity';
import { RoomPayload } from '../dto/room-response.dto';
import { BotService } from '../../bot/services/bot.service';
import { PresenceService } from '../../presence/services/presence.service';
import { OPEN_ROOM_STATUSES } from '../constants/room-status.constants';

@Injectable()
export class RoomService {
  private realtimeNotifier?: (roomId: number) => Promise<void> | void;

  /**
   * Hook optionnel pour notifier les clients WS room (set par RoomGateway).
   */
  setRealtimeNotifier(fn: (roomId: number) => Promise<void> | void): void {
    this.realtimeNotifier = fn;
  }

  async notifyRoomStateUpdated(roomId: number): Promise<void> {
    try {
      await this.realtimeNotifier?.(roomId);
    } catch {
      // best effort
    }
  }
  constructor(
    @InjectRepository(Room) private readonly rooms: Repository<Room>,
    @InjectRepository(RoomParticipant)
    private readonly participants: Repository<RoomParticipant>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @Inject(forwardRef(() => BotService))
    private readonly botService: BotService,
    @Inject(forwardRef(() => PresenceService))
    private readonly presenceService: PresenceService,
  ) {}

  async createRoom(
    userId: number,
    gameType: string,
    name?: string | null,
    maxPlayers?: number | null,
    isPrivate = false,
  ): Promise<Room> {
    const owner = await this.requireUser(userId);
    if (!gameType || gameType.trim() === '') {
      throw new BadRequestException('Type de jeu requis');
    }
    const room = this.rooms.create({
      name: name && name.trim() ? name.trim() : `Table ${gameType}`,
      gameType: gameType.trim(),
      maxPlayers: maxPlayers && maxPlayers > 0 ? maxPlayers : 4,
      isPrivate: isPrivate === true,
      status: 'setup',
      owner,
      createdAt: new Date(),
    });
    await this.rooms.save(room);
    const participant = this.participants.create({
      room,
      user: owner,
      role: 'owner',
    });
    await this.participants.save(participant);
    return room;
  }

  async joinRoom(
    roomId: number,
    userId: number,
    opts?: { allowPrivate?: boolean },
  ): Promise<Room> {
    const room = await this.requireRoom(roomId);
    if (room.isPrivate && !opts?.allowPrivate) {
      throw new BadRequestException('Table privée');
    }
    if (!this.isRoomOpen(room)) {
      throw new BadRequestException('Table déjà démarrée');
    }
    const user = await this.requireUser(userId);
    const activeHumans = await this.countActiveHumans(room.id);
    const bots = await this.countBots(room.id);
    if (activeHumans + bots >= room.maxPlayers) {
      throw new BadRequestException('Table pleine');
    }
    const existing = await this.participants.findOne({
      where: { room: { id: room.id }, user: { id: user.id }, leftAt: IsNull() },
    });
    if (!existing) {
      // Fermer toutes les participations actives de l'utilisateur dans d'autres rooms
      await this.closeAllUserParticipations(userId);

      const participant = this.participants.create({
        room,
        user,
        role: 'player',
      });
      await this.participants.save(participant);
    }

    // Broadcast la mise à jour de présence en temps réel
    this.presenceService.broadcastPresence();

    return room;
  }

  async leaveRoom(roomId: number, userId: number): Promise<Room | null>;
  async leaveRoom(
    roomId: number,
    userId: number,
    opts?: { preserveRoom?: boolean },
  ): Promise<Room | null>;
  async leaveRoom(
    roomId: number,
    userId: number,
    opts?: { preserveRoom?: boolean },
  ): Promise<Room | null> {
    const room = await this.requireRoom(roomId);
    const user = await this.requireUser(userId);
    const participant = await this.participants.findOne({
      where: { room: { id: room.id }, user: { id: user.id }, leftAt: IsNull() },
    });
    if (participant) {
      participant.leftAt = new Date();
      await this.participants.save(participant);
    }
    if (opts?.preserveRoom) {
      this.presenceService.broadcastPresence();
      return room;
    }

    let activeHumans = await this.countActiveHumans(room.id);
    if (activeHumans === 0) {
      // si aucun humain, on supprime les bots restants pour libérer la table
      await this.botService.removeAllBotsForRoom(room.id);
    }
    activeHumans = await this.countActiveHumans(room.id);
    const bots = await this.countBots(room.id);
    const remaining = activeHumans + bots;
    if (remaining === 0) {
      await this.rooms.delete(room.id);
      // Broadcast la mise à jour de présence en temps réel
      this.presenceService.broadcastPresence();
      return null;
    }
    if (room.owner && room.owner.id === userId) {
      const next = await this.participants.findOne({
        where: { room: { id: room.id }, leftAt: IsNull() },
        relations: ['user'],
        order: { joinedAt: 'ASC' },
      });
      if (next?.user) {
        room.owner = next.user;
        await this.rooms.save(room);
      } else {
        room.owner = null;
        await this.rooms.save(room);
      }
    }

    // Broadcast la mise à jour de présence en temps réel
    this.presenceService.broadcastPresence();

    return room;
  }

  async togglePrivacy(roomId: number, userId: number): Promise<Room> {
    const room = await this.requireRoom(roomId);
    this.ensureOwner(room, userId);
    room.isPrivate = !room.isPrivate;
    await this.rooms.save(room);
    return room;
  }

  async startRoom(roomId: number, userId: number): Promise<Room> {
    const room = await this.requireRoom(roomId);
    this.ensureOwner(room, userId);
    const humans = await this.countActiveHumans(room.id);
    const bots = await this.countBots(room.id);
    if (humans + bots < 2) {
      throw new BadRequestException('Au moins deux participants sont requis');
    }
    room.status = 'started';
    room.startedAt = room.startedAt ?? new Date();
    await this.rooms.save(room);
    return room;
  }

  async resetRoom(roomId: number, userId: number): Promise<Room> {
    const room = await this.requireRoom(roomId);
    this.ensureOwner(room, userId);
    room.status = 'setup';
    room.startedAt = null;
    await this.rooms.save(room);
    return room;
  }

  /**
   * Reset système : utilisé par le moteur quand une partie se termine.
   * Ne dépend pas du propriétaire (l'objectif est de pouvoir relancer immédiatement).
   */
  async resetRoomSystem(roomId: number): Promise<Room> {
    const room = await this.requireRoom(roomId);
    room.status = 'setup';
    room.startedAt = null;
    await this.rooms.save(room);
    return room;
  }

  async getRoomPayload(roomId: number): Promise<RoomPayload> {
    const room = await this.rooms.findOne({
      where: { id: roomId },
      relations: ['owner', 'participants', 'participants.user', 'bots'],
    });
    if (!room) {
      throw new NotFoundException('Room introuvable');
    }
    return this.toPayload(room);
  }

  toPayload(room: Room): RoomPayload {
    return {
      room: {
        id: room.id,
        name: room.name,
        isPrivate: room.isPrivate,
        maxPlayers: room.maxPlayers,
        status: room.status,
        gameType: room.gameType,
        counts: {
          players: (room.participants || []).filter((p) => !p.leftAt).length,
          spectators: 0,
        },
        owner: room.owner
          ? { id: room.owner.id, username: room.owner.username }
          : null,
        players: (room.participants || [])
          .filter((p) => !p.leftAt)
          .map((p) => ({ id: p.user.id, username: p.user.username })),
        bots: (room.bots || []).map((b) => ({ id: b.id, name: b.name })),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private async requireRoom(roomId: number): Promise<Room> {
    const room = await this.rooms.findOne({
      where: { id: roomId },
      relations: ['owner'],
    });
    if (!room) {
      throw new NotFoundException('Table introuvable');
    }
    return room;
  }

  private async requireUser(userId: number): Promise<User> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return user;
  }

  private ensureOwner(room: Room, userId: number) {
    if (!room.owner || room.owner.id !== userId) {
      throw new ForbiddenException(
        'Seul le propriétaire peut effectuer cette action',
      );
    }
  }

  private isRoomOpen(room: Room): boolean {
    const status = (room.status || '').toLowerCase();
    return OPEN_ROOM_STATUSES.includes(
      status as (typeof OPEN_ROOM_STATUSES)[number],
    );
  }

  private async countActiveHumans(roomId: number): Promise<number> {
    return this.participants.count({
      where: { room: { id: roomId }, leftAt: IsNull() },
    });
  }

  private async countBots(roomId: number): Promise<number> {
    return this.botService.countBotsForRoom(roomId);
  }

  private async closeAllUserParticipations(userId: number): Promise<void> {
    const activeParticipations = await this.participants.find({
      where: { user: { id: userId }, leftAt: IsNull() },
    });
    const now = new Date();
    for (const participation of activeParticipations) {
      participation.leftAt = now;
    }
    if (activeParticipations.length > 0) {
      await this.participants.save(activeParticipations);
    }
  }
}
