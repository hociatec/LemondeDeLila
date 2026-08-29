import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RoomUserRepository } from '../../../../application/ports/room-user.repository';
import type { RoomUserRecord } from '../../../../application/models/room-user.model';
import { User } from '../../../../../user/public-api';
import { toRoomUserRecord } from './room-typeorm.mappers';

@Injectable()
export class RoomUserTypeormRepository implements RoomUserRepository {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async findById(id: number): Promise<RoomUserRecord | null> {
    return toRoomUserRecord(await this.users.findOne({ where: { id } }));
  }
}
