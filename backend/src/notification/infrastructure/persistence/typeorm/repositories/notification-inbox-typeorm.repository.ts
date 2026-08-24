import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { NotificationInboxRepository } from '../../../../application/ports/notification-inbox.repository';
import type {
  CreateNotificationInboxItemInput,
  NotificationInboxContactRow,
  NotificationInboxItemRecord,
  NotificationInboxPayload,
} from '../../../../application/models/notification-inbox-item.model';
import { NotificationInboxItemNotFoundError } from '../../../../domain/errors/notification-domain.errors';
import { User } from '../../../../../user/public-api';
import { NotificationInboxItemEntity } from '../entities/notification-inbox-item.entity';

@Injectable()
export class NotificationInboxTypeormRepository implements NotificationInboxRepository {
  private readonly logger = new Logger(NotificationInboxTypeormRepository.name);

  constructor(
    @InjectRepository(NotificationInboxItemEntity)
    private readonly repo: Repository<NotificationInboxItemEntity>,
  ) {}

  async create(
    input: CreateNotificationInboxItemInput,
  ): Promise<NotificationInboxItemRecord> {
    const entity = this.repo.create({
      id: input.id,
      user: { id: input.userId } as User,
      kind: input.kind,
      contactId: input.contactId ?? null,
      fromUserId: input.fromUserId ?? null,
      fromUsername: input.fromUsername ?? null,
      toUserId: input.toUserId ?? null,
      message: input.message ?? null,
      payload: input.payload ?? null,
      createdAt: input.createdAt,
      readAt: null,
      deletedAt: null,
    });
    const saved = await this.repo.save(entity);
    return this.getByIdOrThrow(saved.id);
  }

  async list(
    userId: number,
    limit = 200,
  ): Promise<NotificationInboxItemRecord[]> {
    const items = await this.repo.find({
      where: {
        user: { id: userId },
        deletedAt: IsNull(),
      },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['user'],
    });
    return items.filter((it) => !it.deletedAt).map((it) => this.toModel(it));
  }

  async getByIdForUser(
    userId: number,
    id: string,
  ): Promise<NotificationInboxItemRecord | null> {
    const cleanId = String(id || '').trim();
    if (!cleanId) {
      return null;
    }
    const item = await this.repo.findOne({
      where: {
        id: cleanId,
        user: { id: userId },
        deletedAt: IsNull(),
      },
      relations: ['user'],
    });
    return item ? this.toModel(item) : null;
  }

  async markRead(userId: number, id: string): Promise<boolean> {
    const now = new Date();
    const res = await this.repo
      .createQueryBuilder()
      .update(NotificationInboxItemEntity)
      .set({ readAt: now })
      .where('id = :id', { id })
      .andWhere('user_id = :userId', { userId })
      .andWhere('deleted_at IS NULL')
      .andWhere('read_at IS NULL')
      .execute();
    return (res.affected ?? 0) > 0;
  }

  async delete(userId: number, id: string): Promise<boolean> {
    const res = await this.repo
      .createQueryBuilder()
      .delete()
      .from(NotificationInboxItemEntity)
      .where('id = :id', { id })
      .andWhere('user_id = :userId', { userId })
      .execute();
    if ((res.affected ?? 0) > 0) {
      return true;
    }

    const found = await this.repo.findOne({
      where: { id },
      select: { id: true, user: { id: true } },
      relations: ['user'],
      withDeleted: true,
    });
    if (!found) {
      return false;
    }

    this.logger.warn(
      `Hard delete fallback user=${userId} id=${id} owner=${found.user?.id ?? 'none'}`,
    );
    const fallback = await this.repo
      .createQueryBuilder()
      .delete()
      .from(NotificationInboxItemEntity)
      .where('id = :id', { id })
      .execute();
    return (fallback.affected ?? 0) > 0;
  }

  async countUnread(userId: number): Promise<number> {
    return this.repo.count({
      where: {
        user: { id: userId },
        deletedAt: IsNull(),
        readAt: IsNull(),
      },
    });
  }

  async listByContactId(
    kind: string,
    contactId: string,
  ): Promise<NotificationInboxContactRow[]> {
    const cleanKind = String(kind || '').trim();
    const cid = String(contactId || '').trim();
    if (!cleanKind || !cid) {
      return [];
    }

    try {
      const rows = await this.repo
        .createQueryBuilder('it')
        .innerJoin('it.user', 'u')
        .select('it.id', 'id')
        .addSelect('u.id', 'userId')
        .addSelect('it.kind', 'kind')
        .addSelect('it.contactId', 'contactId')
        .addSelect('it.fromUserId', 'fromUserId')
        .addSelect('it.fromUsername', 'fromUsername')
        .addSelect('it.toUserId', 'toUserId')
        .addSelect('it.message', 'message')
        .addSelect('it.payload', 'payload')
        .addSelect('it.createdAt', 'createdAt')
        .addSelect('it.readAt', 'readAt')
        .where('it.kind = :kind', { kind: cleanKind })
        .andWhere('it.contactId = :contactId', { contactId: cid })
        .andWhere('it.deletedAt IS NULL')
        .getRawMany();

      return rows
        .map((row) => ({
          id: String(row?.id ?? ''),
          userId: Number(row?.userId ?? 0),
          kind: String(row?.kind ?? ''),
          contactId: row?.contactId ? String(row.contactId) : null,
          fromUserId: row?.fromUserId == null ? null : Number(row.fromUserId),
          fromUsername: row?.fromUsername ? String(row.fromUsername) : null,
          toUserId: row?.toUserId == null ? null : Number(row.toUserId),
          message: row?.message ? String(row.message) : null,
          payload: this.normalizePayload(row?.payload),
          createdAt: row?.createdAt ? new Date(row.createdAt) : new Date(),
          readAt: row?.readAt ? new Date(row.readAt) : null,
        }))
        .filter((row) => row.id && row.userId > 0);
    } catch (err) {
      this.logger.warn(
        `listByContactId failed kind=${kind} contactId=${contactId}: ${(err as Error).message}`,
      );
      return [];
    }
  }

  async updatePayload(
    id: string,
    payload: NotificationInboxPayload,
  ): Promise<boolean> {
    const clean = String(id || '').trim();
    if (!clean) {
      return false;
    }
    const res = await this.repo
      .createQueryBuilder()
      .update(NotificationInboxItemEntity)
      .set({ payload: payload ?? null } as never)
      .where('id = :id', { id: clean })
      .execute();
    return (res.affected ?? 0) > 0;
  }

  async deleteManyByIds(ids: string[]): Promise<number> {
    const clean = Array.from(
      new Set((ids ?? []).map((value) => String(value || '').trim())),
    ).filter(Boolean);
    if (clean.length === 0) {
      return 0;
    }
    const res = await this.repo
      .createQueryBuilder()
      .delete()
      .from(NotificationInboxItemEntity)
      .where('id IN (:...ids)', { ids: clean })
      .execute();
    return res.affected ?? 0;
  }

  private async getByIdOrThrow(
    id: string,
  ): Promise<NotificationInboxItemRecord> {
    const item = await this.repo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!item) {
      throw new NotificationInboxItemNotFoundError(
        `Notification inbox item ${id} not found after save`,
      );
    }
    return this.toModel(item);
  }

  private toModel(
    entity: NotificationInboxItemEntity,
  ): NotificationInboxItemRecord {
    return {
      id: entity.id,
      userId: entity.user?.id ?? 0,
      kind: entity.kind,
      contactId: entity.contactId ?? null,
      fromUserId: entity.fromUserId ?? null,
      fromUsername: entity.fromUsername ?? null,
      toUserId: entity.toUserId ?? null,
      message: entity.message ?? null,
      payload: this.normalizePayload(entity.payload),
      createdAt: entity.createdAt,
      readAt: entity.readAt ?? null,
      deletedAt: entity.deletedAt ?? null,
    };
  }

  private normalizePayload(value: unknown): NotificationInboxPayload {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }
}
