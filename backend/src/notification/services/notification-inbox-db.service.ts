import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationInboxItem } from '../entities/notification-inbox-item.entity';
import { User } from '../../user/entities/user.entity';

export type CreateInboxItemInput = {
  id: string;
  userId: number;
  kind: string;
  createdAt: Date;
  contactId?: string | null;
  fromUserId?: number | null;
  fromUsername?: string | null;
  toUserId?: number | null;
  message?: string | null;
  payload?: any;
};

export type InboxContactRow = {
  id: string;
  userId: number;
  kind: string;
  contactId: string | null;
  fromUserId: number | null;
  fromUsername: string | null;
  toUserId: number | null;
  message: string | null;
  payload: any;
  createdAt: Date;
  readAt: Date | null;
};

@Injectable()
export class NotificationInboxDbService {
  private readonly logger = new Logger(NotificationInboxDbService.name);

  constructor(
    @InjectRepository(NotificationInboxItem)
    private readonly repo: Repository<NotificationInboxItem>,
  ) {}

  async create(input: CreateInboxItemInput): Promise<NotificationInboxItem> {
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
    return this.repo.save(entity);
  }

  async list(userId: number, limit = 200): Promise<NotificationInboxItem[]> {
    const items = await this.repo.find({
      where: { user: { id: userId }, deletedAt: null } as any,
      order: { createdAt: 'DESC' },
      take: limit,
    });
    // Safety: ensure soft-deleted rows never leak if the DB filter fails.
    return items.filter((it) => !it.deletedAt);
  }

  async markRead(userId: number, id: string): Promise<boolean> {
    const now = new Date();
    const res = await this.repo
      .createQueryBuilder()
      .update(NotificationInboxItem)
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
      .from(NotificationInboxItem)
      .where('id = :id', { id })
      .andWhere('user_id = :userId', { userId })
      .execute();
    if ((res.affected ?? 0) > 0) return true;

    // Fallback debug path: delete by id only (in case of inconsistent user_id).
    const found = await this.repo.findOne({
      where: { id } as any,
      select: { id: true, user: { id: true } } as any,
      relations: ['user'],
      withDeleted: true,
    });
    if (found) {
      this.logger.warn(
        `Hard delete fallback user=${userId} id=${id} owner=${found.user?.id ?? 'none'}`,
      );
      const res2 = await this.repo
        .createQueryBuilder()
        .delete()
        .from(NotificationInboxItem)
        .where('id = :id', { id })
        .execute();
      return (res2.affected ?? 0) > 0;
    }
    return false;
  }

  async countUnread(userId: number): Promise<number> {
    return this.repo.count({
      where: {
        user: { id: userId },
        deletedAt: null,
        readAt: null,
      } as any,
    });
  }

  async listByContactId(
    kind: string,
    contactId: string,
  ): Promise<InboxContactRow[]> {
    const cleanKind = String(kind || '').trim();
    const cid = String(contactId || '').trim();
    if (!cleanKind || !cid) return [];

    try {
      const qb = this.repo
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
        .andWhere('it.deletedAt IS NULL');

      const rows = (await qb.getRawMany()) as Array<any>;
      return rows
        .map((r) => ({
          id: String(r?.id ?? ''),
          userId: Number(r?.userId ?? 0),
          kind: String(r?.kind ?? ''),
          contactId: r?.contactId ? String(r.contactId) : null,
          fromUserId:
            r?.fromUserId == null ? null : Number(r.fromUserId),
          fromUsername: r?.fromUsername ? String(r.fromUsername) : null,
          toUserId: r?.toUserId == null ? null : Number(r.toUserId),
          message: r?.message ? String(r.message) : null,
          payload: r?.payload ?? null,
          createdAt: r?.createdAt ? new Date(r.createdAt) : new Date(),
          readAt: r?.readAt ? new Date(r.readAt) : null,
        }))
        .filter((r) => r.id && r.userId > 0);
    } catch (err) {
      this.logger.warn(
        `listByContactId failed kind=${kind} contactId=${contactId}: ${(err as Error).message}`,
      );
      return [];
    }
  }

  async updatePayload(id: string, payload: any): Promise<boolean> {
    const clean = String(id || '').trim();
    if (!clean) return false;
    const res = await this.repo
      .createQueryBuilder()
      .update(NotificationInboxItem)
      .set({ payload: payload ?? null })
      .where('id = :id', { id: clean })
      .execute();
    return (res.affected ?? 0) > 0;
  }

  async deleteManyByIds(ids: string[]): Promise<number> {
    const clean = Array.from(new Set((ids ?? []).map((x) => String(x || '').trim())))
      .filter((x) => x);
    if (clean.length === 0) return 0;
    const res = await this.repo
      .createQueryBuilder()
      .delete()
      .from(NotificationInboxItem)
      .where('id IN (:...ids)', { ids: clean })
      .execute();
    return res.affected ?? 0;
  }
}
