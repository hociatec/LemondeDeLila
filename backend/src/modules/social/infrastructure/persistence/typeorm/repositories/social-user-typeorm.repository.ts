import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { SocialUserReader } from '../../../../application/ports/social-user.repository';
import type {
  SocialSearchUserSummary,
  SocialUserSummary,
} from '../../../../application/contracts/social-user.model';
import { User } from '../../../../../user/public-api';
import { SocialProfileEntity } from '../entities/social-profile.entity';

@Injectable()
export class SocialUserTypeormRepository implements SocialUserReader {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async findById(id: number): Promise<SocialUserSummary | null> {
    const user = await this.users.findOne({
      where: { id },
      select: { id: true, username: true, avatar: true },
    });
    if (!user) {
      return null;
    }
    return {
      id: user.id,
      username: user.username,
      avatar: user.avatar ?? null,
    };
  }

  async searchUsers(
    query: string,
    excludeUserId: number,
    limit: number,
  ): Promise<SocialSearchUserSummary[]> {
    const sanitized = query.trim();
    const buildQuery = (accentInsensitive: boolean) => {
      const qb = this.users
        .createQueryBuilder('u')
        .leftJoin(SocialProfileEntity, 'p', 'p.userId = u.id')
        .select('u.id', 'id')
        .addSelect('u.username', 'username')
        .addSelect('u.avatar', 'avatar')
        .addSelect("COALESCE(p.visibility, 'public')", 'profileVisibility')
        .limit(limit);

      if (accentInsensitive) {
        qb.where(
          'u.username COLLATE utf8mb4_0900_ai_ci LIKE :query COLLATE utf8mb4_0900_ai_ci',
          { query: `%${sanitized}%` },
        )
          .andWhere('u.id != :excludeUserId', { excludeUserId })
          .orderBy('u.username COLLATE utf8mb4_0900_ai_ci', 'ASC')
          .addOrderBy('u.username', 'ASC')
          .addOrderBy('u.id', 'ASC');
        return qb;
      }

      qb.where('LOWER(u.username) LIKE :query', {
        query: `%${sanitized.toLowerCase()}%`,
      }).andWhere('u.id != :excludeUserId', { excludeUserId });
      return qb;
    };

    let rows: Array<{
      id: number;
      username: string;
      avatar: string | null;
      profileVisibility: 'public' | 'friends' | 'private';
    }>;

    try {
      rows = await buildQuery(true).limit(limit).getRawMany();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/collation/i.test(message)) {
        throw error;
      }
      rows = await buildQuery(false).limit(limit).getRawMany();
    }

    return rows.map((row) => ({
      id: row.id,
      username: row.username,
      avatar: row.avatar ?? null,
      profileVisibility: row.profileVisibility ?? 'public',
    }));
  }
}
