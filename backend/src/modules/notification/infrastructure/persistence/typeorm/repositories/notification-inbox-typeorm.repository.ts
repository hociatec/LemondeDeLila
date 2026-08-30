import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { getErrorMessage } from '@shared/utils/public-api';
import type { NotificationInboxRepository } from '../../../../application/ports/notification-inbox.repository';
import type {
  CreateNotificationInboxItemInput,
  NotificationInboxContactRow,
  NotificationInboxItemRecord,
  NotificationInboxPayload,
} from '../../../../application/contracts/notification-inbox-item.model';
import { NotificationInboxItemNotFoundError } from '../../../../domain/errors/notification-domain.errors';
import { User } from '../../../../../user/public-api';
import { NotificationInboxItemEntity } from '../entities/notification-inbox-item.entity';

type NotificationInboxContactRawRow = {
  id: unknown;
  userId: unknown;
  kind: unknown;
  contactId: unknown;
  fromUserId: unknown;
  fromUsername: unknown;
  toUserId: unknown;
  message: unknown;
  payload: unknown;
  createdAt: unknown;
  readAt: unknown;
};

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
      relations: { user: true },
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
      relations: { user: true },
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
    return (res.affected ?? 0) > 0;
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
        .limit(500)
        .getRawMany<NotificationInboxContactRawRow>();

      return rows
        .map((row) => ({
          id: toText(row.id),
          userId: Number(row?.userId ?? 0),
          kind: toText(row.kind),
          contactId: toNullableText(row.contactId),
          fromUserId: row?.fromUserId == null ? null : Number(row.fromUserId),
          fromUsername: toNullableText(row.fromUsername),
          toUserId: row?.toUserId == null ? null : Number(row.toUserId),
          message: toNullableText(row.message),
          payload: this.normalizePayload(row?.payload),
          createdAt: toDate(row.createdAt) ?? new Date(),
          readAt: toDate(row.readAt),
        }))
        .filter((row) => row.id && row.userId > 0);
    } catch (err) {
      this.logger.warn(
        `listByContactId failed kind=${kind} contactId=${contactId}: ${getErrorMessage(err)}`,
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
    const item = await this.repo.findOne({
      where: { id: clean },
      withDeleted: true,
    });
    if (!item) {
      return false;
    }
    item.payload = payload ?? null;
    await this.repo.save(item);
    return true;
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
      relations: { user: true },
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

function toText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : '';
}

function toNullableText(value: unknown): string | null {
  const text = toText(value);
  return text || null;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
