import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { MessagingUserReader } from '../../../../application/ports/messaging-user.repository';
import type { MessageUser } from '../../../../application/models/message-user.model';

@Injectable()
export class MessagingUserTypeormRepository implements MessagingUserReader {
  constructor(private readonly dataSource: DataSource) {}

  async findById(id: number): Promise<MessageUser | null> {
    const rows = await this.dataSource.query(
      'SELECT id, username FROM users WHERE id = ? LIMIT 1',
      [id],
    );
    const user = rows[0] as { id?: unknown; username?: unknown } | undefined;
    if (!user) return null;
    const userId = toPositiveSafeId(user?.id);
    if (userId === null) return null;
    return {
      id: userId,
      username: typeof user.username === 'string' ? user.username : '',
    };
  }

  async findByUsername(username: string): Promise<MessageUser | null> {
    const rows = await this.dataSource.query(
      'SELECT id, username FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1',
      [username],
    );
    const user = rows[0] as { id?: unknown; username?: unknown } | undefined;
    if (!user) return null;
    const userId = toPositiveSafeId(user?.id);
    if (userId === null) return null;
    return {
      id: userId,
      username: typeof user.username === 'string' ? user.username : '',
    };
  }
}

function toPositiveSafeId(value: unknown): number | null {
  const id = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
