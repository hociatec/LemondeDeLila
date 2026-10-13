import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserShortcutsEntity } from '../entities/user-shortcuts.entity';
import type { UserShortcutsRepository } from '../../../../application/ports/user-shortcuts.repository';
import type {
  UserShortcut,
  UserShortcuts,
} from '../../../../domain/models/user-shortcuts.model';

@Injectable()
export class UserShortcutsTypeormRepository implements UserShortcutsRepository {
  constructor(
    @InjectRepository(UserShortcutsEntity)
    private readonly rows: Repository<UserShortcutsEntity>,
  ) {}
  async get(userId: number): Promise<UserShortcuts> {
    const row = await this.rows.findOneBy({ userId });
    return row
      ? { revision: row.revision, items: row.items }
      : { revision: 0, items: [] };
  }
  async replace(
    userId: number,
    revision: number,
    items: UserShortcut[],
  ): Promise<boolean> {
    if (revision === 0)
      await this.rows
        .createQueryBuilder()
        .insert()
        .values({ userId, revision: 0, items: [] })
        .orIgnore()
        .execute();
    const result = await this.rows
      .createQueryBuilder()
      .update()
      .set({ items, revision: revision + 1 })
      .where('user_id = :userId AND revision = :revision', { userId, revision })
      .execute();
    return result.affected === 1;
  }
}
