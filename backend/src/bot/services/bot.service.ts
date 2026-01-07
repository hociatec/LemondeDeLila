import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { OPEN_ROOM_STATUSES } from '../../room/constants/room-status.constants';
import { RoomBot } from '../../room/entities/room-bot.entity';
import { Room } from '../../room/entities/room.entity';
import { RoomParticipant } from '../../room/entities/room-participant.entity';
import { BotName } from '../entities/bot-name.entity';

@Injectable()
export class BotService {
  private cachedEnabledNames: { values: string[]; expiresAt: number } | null =
    null;
  private readonly namesCacheTtlMs: number;

  constructor(
    @InjectRepository(RoomBot) private readonly bots: Repository<RoomBot>,
    @InjectRepository(Room) private readonly rooms: Repository<Room>,
    @InjectRepository(RoomParticipant)
    private readonly participants: Repository<RoomParticipant>,
    @InjectRepository(BotName) private readonly botNames: Repository<BotName>,
  ) {
    const ttlCandidate = Number(process.env.BOT_NAMES_CACHE_TTL_MS ?? 30000);
    this.namesCacheTtlMs =
      Number.isFinite(ttlCandidate) && ttlCandidate >= 0 ? ttlCandidate : 30000;
  }

  async addBot(roomId: number, userId: number): Promise<RoomBot> {
    const room = await this.requireRoomWithOwner(roomId);
    this.ensureOwner(room, userId);
    if (!this.isRoomOpen(room)) {
      throw new BadRequestException('Table deja demarree');
    }
    const [humans, existingBots] = await Promise.all([
      this.countActiveHumans(room.id),
      this.bots.find({ where: { room: { id: room.id } } }),
    ]);
    const botsCount = existingBots.length;
    if (humans + botsCount >= room.maxPlayers) {
      throw new BadRequestException('Table pleine');
    }
    const name = await this.pickName(existingBots);
    const bot = this.bots.create({ room, name });
    return this.bots.save(bot);
  }

  /**
   * Ajout système d'un bot (sans droits owner) pour maintenir une table jouable.
   * - Autorisé même si la table a démarré
   * - Respecte maxPlayers (humains actifs + bots)
   */
  async addBotSystem(roomId: number): Promise<RoomBot> {
    const room = await this.rooms.findOne({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException('Table introuvable');
    }

    const [humans, existingBots] = await Promise.all([
      this.countActiveHumans(room.id),
      this.bots.find({ where: { room: { id: room.id } } }),
    ]);
    const botsCount = existingBots.length;
    if (humans + botsCount >= room.maxPlayers) {
      throw new BadRequestException('Table pleine');
    }

    const name = await this.pickName(existingBots);
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
    if (!this.isRoomOpen(room)) {
      throw new BadRequestException('Table deja demarree');
    }
    const bot = await this.bots.findOne({
      where: { id: botId, room: { id: room.id } },
    });
    if (!bot) {
      throw new NotFoundException('Bot introuvable');
    }
    await this.bots.delete(bot.id);
    return bot;
  }

  async getLastBotForRoom(roomId: number): Promise<RoomBot | null> {
    return this.bots.findOne({
      where: { room: { id: roomId } },
      order: { id: 'DESC' },
    });
  }

  async statsForRoom(roomId: number) {
    const total = await this.countBots(roomId);
    return { roomId, total };
  }

  async listBotNames(): Promise<BotName[]> {
    return this.botNames.find({ order: { name: 'ASC' } });
  }

  async createBotName(name: string, enabled = true): Promise<BotName> {
    const sanitized = this.sanitizeName(name);
    if (!sanitized) {
      throw new BadRequestException('Nom requis');
    }
    const exists = await this.botNames.findOne({ where: { name: sanitized } });
    if (exists) {
      throw new BadRequestException('Nom déjà utilisé');
    }
    const botName = this.botNames.create({ name: sanitized, enabled });
    const saved = await this.botNames.save(botName);
    this.invalidateBotNamesCache();
    return saved;
  }

  async updateBotName(
    id: number,
    update: { name?: string | null; enabled?: boolean | null },
  ): Promise<BotName> {
    const botName = await this.botNames.findOne({ where: { id } });
    if (!botName) {
      throw new NotFoundException('Bot introuvable');
    }

    if (update.name != null) {
      const sanitized = this.sanitizeName(update.name);
      if (!sanitized) {
        throw new BadRequestException('Nom requis');
      }
      if (sanitized !== botName.name) {
        const exists = await this.botNames.findOne({
          where: { name: sanitized },
        });
        if (exists) {
          throw new BadRequestException('Nom déjà utilisé');
        }
        botName.name = sanitized;
      }
    }

    if (update.enabled != null) {
      botName.enabled = Boolean(update.enabled);
    }

    const saved = await this.botNames.save(botName);
    this.invalidateBotNamesCache();
    return saved;
  }

  async deleteBotName(id: number): Promise<BotName> {
    const botName = await this.botNames.findOne({ where: { id } });
    if (!botName) {
      throw new NotFoundException('Bot introuvable');
    }
    await this.botNames.delete(botName.id);
    this.invalidateBotNamesCache();
    return botName;
  }

  private async pickName(existing: RoomBot[]): Promise<string> {
    const names = existing.map((b) => b.name.toLowerCase());
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
    throw new BadRequestException('Plus de noms de bots disponibles');
  }

  private async getEnabledNames(): Promise<string[]> {
    const cached = this.cachedEnabledNames;
    if (
      cached &&
      (this.namesCacheTtlMs === 0 || Date.now() < cached.expiresAt)
    ) {
      return this.shuffle(cached.values);
    }

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
      const values = seeded.map((r) => r.name);
      this.cachedEnabledNames = {
        values,
        expiresAt:
          this.namesCacheTtlMs === 0
            ? Number.MAX_SAFE_INTEGER
            : Date.now() + this.namesCacheTtlMs,
      };
      return this.shuffle(values);
    }
    const values = rows.map((r) => r.name);
    this.cachedEnabledNames = {
      values,
      expiresAt:
        this.namesCacheTtlMs === 0
          ? Number.MAX_SAFE_INTEGER
          : Date.now() + this.namesCacheTtlMs,
    };
    return this.shuffle(values);
  }

  private invalidateBotNamesCache(): void {
    this.cachedEnabledNames = null;
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
        'Seul le proprietaire peut gerer les bots',
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
