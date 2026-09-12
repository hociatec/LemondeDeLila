import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { SocialUserReader } from '../../../../application/ports/social-user.repository';
import type {
  SocialSearchUserSummary,
  SocialUserSummary,
} from '../../../../application/models/social-user.model';

type UserRow = { id?: unknown; username?: unknown; avatar?: unknown };
type SearchRow = {
  id: number;
  username: string;
  avatar: string | null;
  profileVisibility: 'public' | 'friends' | 'private';
};

@Injectable()
export class SocialUserTypeormRepository implements SocialUserReader {
  constructor(private readonly dataSource: DataSource) {}

  async findById(id: number): Promise<SocialUserSummary | null> {
    const rows = await this.dataSource.query<UserRow[]>(
      'SELECT id, username, avatar FROM users WHERE id = ? LIMIT 1',
      [id],
    );
    const user = rows[0];
    if (!user) return null;
    const userId = toPositiveSafeId(user?.id);
    if (userId === null) {
      return null;
    }
    return {
      id: userId,
      username: typeof user.username === 'string' ? user.username : '',
      avatar: typeof user.avatar === 'string' ? user.avatar : null,
    };
  }

  async searchUsers(
    query: string,
    excludeUserId: number,
    limit: number,
  ): Promise<SocialSearchUserSummary[]> {
    const sanitized = String(query ?? '')
      .trim()
      .slice(0, 255);
    const safeLimit =
      Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 100) : 50;
    const buildQuery = (accentInsensitive: boolean) =>
      accentInsensitive
        ? this.dataSource.query<SearchRow[]>(
            `SELECT u.id AS id, u.username AS username, u.avatar AS avatar,
              COALESCE(p.visibility, 'public') AS profileVisibility
             FROM users u LEFT JOIN social_profiles p ON p.user_id = u.id
             WHERE u.username COLLATE utf8mb4_0900_ai_ci LIKE ? COLLATE utf8mb4_0900_ai_ci AND u.id != ?
             ORDER BY u.username COLLATE utf8mb4_0900_ai_ci ASC, u.id ASC LIMIT ?`,
            [`%${sanitized}%`, excludeUserId, safeLimit],
          )
        : this.dataSource.query<SearchRow[]>(
            `SELECT u.id AS id, u.username AS username, u.avatar AS avatar,
              COALESCE(p.visibility, 'public') AS profileVisibility
             FROM users u LEFT JOIN social_profiles p ON p.user_id = u.id
             WHERE LOWER(u.username) LIKE ? AND u.id != ?
             ORDER BY LOWER(u.username) ASC, u.id ASC LIMIT ?`,
            [`%${sanitized.toLowerCase()}%`, excludeUserId, safeLimit],
          );

    let rows: SearchRow[];

    try {
      rows = await buildQuery(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/collation/i.test(message)) {
        throw error;
      }
      rows = await buildQuery(false);
    }

    return rows
      .map((row) => {
        const id = toPositiveSafeId(row.id);
        if (id === null || typeof row.username !== 'string') return null;
        return {
          id,
          username: row.username.slice(0, 255),
          avatar: typeof row.avatar === 'string' ? row.avatar : null,
          profileVisibility: row.profileVisibility ?? 'public',
        };
      })
      .filter((row): row is SocialSearchUserSummary => row !== null);
  }
}

function toPositiveSafeId(value: unknown): number | null {
  const id = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
