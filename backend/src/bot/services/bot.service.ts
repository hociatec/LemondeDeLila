import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { RoomBot } from '../../room/entities/room-bot.entity';
import { Room } from '../../room/entities/room.entity';
import { RoomParticipant } from '../../room/entities/room-participant.entity';
import { OPEN_ROOM_STATUSES } from '../../room/constants/room-status.constants';
import { BotName } from '../entities/bot-name.entity';

@Injectable()
export class BotService {
  constructor(
    @InjectRepository(RoomBot) private readonly bots: Repository<RoomBot>,
    @InjectRepository(Room) private readonly rooms: Repository<Room>,
    @InjectRepository(RoomParticipant)
    private readonly participants: Repository<RoomParticipant>,
    @InjectRepository(BotName) private readonly botNames: Repository<BotName>,
  ) {}

  async addBot(
    roomId: number,
    userId: number,
    requestedName?: string | null,
  ): Promise<RoomBot> {
    const room = await this.requireRoomWithOwner(roomId);
    this.ensureOwner(room, userId);
    if (!this.isRoomOpen(room)) {
      throw new BadRequestException('Table déjà démarrée');
    }
    const humans = await this.countActiveHumans(room.id);
    const botsCount = await this.countBots(room.id);
    if (humans + botsCount >= room.maxPlayers) {
      throw new BadRequestException('Table pleine');
    }
    const name = await this.pickName(room.id, requestedName);
    const bot = this.bots.create({ room, name });
    return this.bots.save(bot);
  }

  async removeBot(
    roomId: number,
    userId: number,
    botId: number,
  ): Promise<RoomBot> {
    const room = await this.requireRoomWithOwner(roomId);
    this.ensureOwner(room, userId);
    const bot = await this.bots.findOne({
      where: { id: botId, room: { id: room.id } },
    });
    if (!bot) {
      throw new NotFoundException('Bot introuvable');
    }
    await this.bots.delete(bot.id);
    return bot;
  }

  async statsForRoom(roomId: number) {
    const total = await this.countBots(roomId);
    return { roomId, total };
  }

  private async pickName(
    roomId: number,
    requested?: string | null,
  ): Promise<string> {
    const existing = await this.bots.find({ where: { room: { id: roomId } } });
    const names = existing.map((b) => b.name.toLowerCase());
    if (requested && requested.trim()) {
      const base = this.sanitizeName(requested.trim());
      if (!names.includes(base.toLowerCase())) {
        return base;
      }
    }
    return this.findAvailableName(names);
  }

  private sanitizeName(name: string): string {
    const normalized = name.replace(/\s+/g, ' ').trim();
    return normalized.length > 100 ? normalized.slice(0, 100) : normalized;
  }

  private async findAvailableName(existing: string[]): Promise<string> {
    const exclude = new Set(existing.map((n) => n.toLowerCase()));
    const names = await this.getEnabledNames();
    for (const candidate of names) {
      const sanitized = this.sanitizeName(candidate);
      if (!exclude.has(sanitized.toLowerCase())) {
        return sanitized;
      }
    }
    const base = names[0] ?? 'Bot';
    let suffix = 2;
    while (suffix < 1000) {
      const candidate = this.sanitizeName(`${base} #${suffix}`);
      if (!exclude.has(candidate.toLowerCase())) {
        return candidate;
      }
      suffix++;
    }
    return this.sanitizeName(base);
  }

  private async getEnabledNames(): Promise<string[]> {
    const rows = await this.botNames.find({
      where: { enabled: true },
      order: { name: 'ASC' },
    });
    if (rows.length === 0) {
      await this.seedDefaultNames();
      const seeded = await this.botNames.find({
        where: { enabled: true },
        order: { name: 'ASC' },
      });
      return this.shuffle(seeded.map((r) => r.name));
    }
    return this.shuffle(rows.map((r) => r.name));
  }

  private async seedDefaultNames(): Promise<void> {
    const defaults = ['Lila', 'Cosmo', 'Nova', 'Pixel', 'Orion', 'Echo', 'Bot'];
    const count = await this.botNames.count();
    if (count > 0) return;
    const rows = defaults.map((name) =>
      this.botNames.create({ name, enabled: true }),
    );
    await this.botNames.save(rows);
  }

  private shuffle(values: string[]): string[] {
    const arr = [...values];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private async countBots(roomId: number): Promise<number> {
    return this.bots.count({ where: { room: { id: roomId } } });
  }

  async countBotsForRoom(roomId: number): Promise<number> {
    return this.countBots(roomId);
  }

  async removeAllBotsForRoom(roomId: number): Promise<void> {
    await this.bots.delete({ room: { id: roomId } as any });
  }

  private async countActiveHumans(roomId: number): Promise<number> {
    return this.participants.count({
      where: { room: { id: roomId }, leftAt: IsNull() },
    });
  }

  private async requireRoomWithOwner(roomId: number): Promise<Room> {
    const room = await this.rooms.findOne({
      where: { id: roomId },
      relations: ['owner'],
    });
    if (!room) {
      throw new NotFoundException('Table introuvable');
    }
    return room;
  }

  private ensureOwner(room: Room, userId: number) {
    if (!room.owner || room.owner.id !== userId) {
      throw new UnauthorizedException(
        'Seul le propriétaire peut gérer les bots',
      );
    }
  }

  private isRoomOpen(room: Room): boolean {
    const status = (room.status || '').toLowerCase();
    return OPEN_ROOM_STATUSES.includes(
      status as (typeof OPEN_ROOM_STATUSES)[number],
    );
  }
}
