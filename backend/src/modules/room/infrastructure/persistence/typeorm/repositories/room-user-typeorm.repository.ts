import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { RoomUserRepository } from '../../../../application/ports/room-user.repository';
import type { RoomUserRecord } from '../../../../application/models/room-user.model';
import { asUserId } from '../../../../../../shared/interfaces/public-api';

@Injectable()
export class RoomUserTypeormRepository implements RoomUserRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findById(id: number): Promise<RoomUserRecord | null> {
    const rows = await this.dataSource.query(
      'SELECT id, username, roles FROM users WHERE id = ? LIMIT 1',
      [id],
    );
    const row = rows[0] as
      { id?: unknown; username?: unknown; roles?: unknown } | undefined;
    if (!row) return null;
    const userId = toPositiveSafeId(row?.id);
    if (userId === null) return null;
    return {
      id: asUserId(userId),
      username: typeof row.username === 'string' ? row.username : '',
      roles: decodeRoles(row.roles),
    };
  }
}

function decodeRoles(value: unknown): string[] {
  const parsed =
    typeof value === 'string'
      ? (() => {
          try {
            return JSON.parse(value) as unknown;
          } catch {
            return [];
          }
        })()
      : value;
  return Array.isArray(parsed)
    ? parsed
        .filter(
          (role): role is string =>
            typeof role === 'string' && role.length <= 64,
        )
        .slice(0, 32)
    : [];
}

function toPositiveSafeId(value: unknown): number | null {
  const id = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
