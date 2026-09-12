import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  In,
  IsNull,
  LessThanOrEqual,
  MoreThan,
  Not,
  type Repository,
} from 'typeorm';
import type { RoomInvite } from '../../../../application/models/room-invite.model';
import type { RoomInviteRepository } from '../../../../application/ports/room-invite.repository';
import { RoomInviteEntity } from '../entities/room-invite.entity';

@Injectable()
export class RoomInviteTypeormRepository implements RoomInviteRepository {
  constructor(
    @InjectRepository(RoomInviteEntity)
    private readonly repository: Repository<RoomInviteEntity>,
  ) {}

  async save(invite: RoomInvite): Promise<void> {
    await this.repository.insert(this.toEntity(invite));
  }

  async findValidById(id: string, nowMs: number): Promise<RoomInvite | null> {
    return this.toModel(
      await this.repository.findOne({
        where: { id, expiresAt: MoreThan(new Date(nowMs)) },
      }),
    );
  }

  async findActive(
    roomId: number,
    toUserId: number,
    nowMs: number,
  ): Promise<RoomInvite | null> {
    return this.toModel(
      await this.repository.findOne({
        where: {
          roomId,
          toUserId,
          consumedAt: IsNull(),
          expiresAt: MoreThan(new Date(nowMs)),
        },
        order: { createdAt: 'DESC', id: 'ASC' },
      }),
    );
  }

  async findActiveRecipientIds(
    roomId: number,
    userIds: readonly number[],
    nowMs: number,
  ): Promise<number[]> {
    const rows = await this.repository.find({
      where: {
        roomId,
        toUserId: In([...userIds]),
        consumedAt: IsNull(),
        expiresAt: MoreThan(new Date(nowMs)),
      },
      select: { toUserId: true },
      take: 1_000,
    });
    return [...new Set(rows.map((row) => row.toUserId))];
  }

  async consume(
    id: string,
    consumedAtMs: number,
    nowMs: number,
    keep: boolean,
  ): Promise<RoomInvite | null> {
    return this.repository.manager.transaction(async (manager) => {
      const rows = manager.getRepository(RoomInviteEntity);
      const current = await rows.findOne({
        where: { id, expiresAt: MoreThan(new Date(nowMs)) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!current) return null;
      const invite = this.toModel(current);
      if (!keep) {
        await rows.delete({ id });
        return invite;
      }
      current.consumedAt ??= new Date(consumedAtMs);
      return this.toModel(await rows.save(current));
    });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }

  async deleteExpired(nowMs: number, limit: number): Promise<void> {
    const boundedLimit = Math.max(1, Math.min(1_000, Math.trunc(limit)));
    const expired = await this.repository.find({
      where: { expiresAt: LessThanOrEqual(new Date(nowMs)) },
      select: { id: true },
      order: { expiresAt: 'ASC', id: 'ASC' },
      take: boundedLimit,
    });
    if (expired.length > 0)
      await this.repository.delete(expired.map((row) => row.id));
  }

  async canSpectate(
    roomId: number,
    userId: number,
    nowMs: number,
  ): Promise<boolean> {
    return (
      (await this.repository.count({
        where: {
          roomId,
          toUserId: userId,
          consumedAt: Not(IsNull()),
          expiresAt: MoreThan(new Date(nowMs)),
        },
        take: 1,
      })) > 0
    );
  }

  private toEntity(invite: RoomInvite): RoomInviteEntity {
    return this.repository.create({
      ...invite,
      createdAt: new Date(invite.createdAt),
      expiresAt: new Date(invite.expiresAt),
      consumedAt:
        invite.consumedAt == null ? null : new Date(invite.consumedAt),
    });
  }

  private toModel(entity: RoomInviteEntity | null): RoomInvite | null {
    return entity
      ? {
          id: entity.id,
          roomId: entity.roomId,
          fromUserId: entity.fromUserId,
          toUserId: entity.toUserId,
          createdAt: entity.createdAt.getTime(),
          expiresAt: entity.expiresAt.getTime(),
          consumedAt: entity.consumedAt?.getTime() ?? null,
        }
      : null;
  }
}
