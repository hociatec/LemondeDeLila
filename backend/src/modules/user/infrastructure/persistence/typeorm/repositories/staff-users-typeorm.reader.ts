import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import type { StaffUsersReader } from '../../../../application/ports/staff-users-reader.port';
import { User } from '../entities/user.entity';

@Injectable()
export class StaffUsersTypeormReader implements StaffUsersReader {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async listStaff(): Promise<{ id: number }[]> {
    const staff: { id: number }[] = [];
    let afterId = 0;
    for (;;) {
      const batch = await this.users.find({
        where: { id: MoreThan(afterId) },
        select: { id: true, roles: true },
        order: { id: 'ASC' },
        take: 500,
      });
      if (batch.length === 0) return staff;
      for (const user of batch) {
        if (
          Array.isArray(user.roles) &&
          user.roles.some((role) =>
            ['ROLE_ADMIN', 'admin', 'ROLE_MODERATOR', 'moderator'].includes(
              role,
            ),
          )
        )
          staff.push({ id: user.id });
      }
      const last = batch[batch.length - 1].id;
      if (!Number.isSafeInteger(last) || last <= afterId)
        throw new Error('Invalid staff scan cursor');
      afterId = last;
    }
  }
}
