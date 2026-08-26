import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import type { MessagingUserReader } from '../../../../application/ports/messaging-user.repository';
import type { MessageUser } from '../../../../application/models/message-user.model';
import { User } from '../../../../../user/public-api';

@Injectable()
export class MessagingUserTypeormRepository implements MessagingUserReader {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async findById(id: number): Promise<MessageUser | null> {
    const user = await this.users.findOne({
      where: { id },
      select: { id: true, username: true },
    });
    if (!user) {
      return null;
    }
    return { id: user.id, username: user.username };
  }

  async findByUsername(username: string): Promise<MessageUser | null> {
    const user = await this.users
      .createQueryBuilder('u')
      .select(['u.id', 'u.username'])
      .where('LOWER(u.username) = LOWER(:username)', { username })
      .getOne();
    if (!user) {
      return null;
    }
    return { id: user.id, username: user.username };
  }
}
