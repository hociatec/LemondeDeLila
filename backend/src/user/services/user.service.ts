import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.users.find({
      select: [
        'id',
        'email',
        'username',
        'avatar',
        'roles',
        'emailVerified',
        'createdAt',
      ],
      order: { id: 'ASC' },
    });
  }

  async findOne(id: number): Promise<User> {
    const user = await this.users.findOne({
      where: { id },
      select: [
        'id',
        'email',
        'username',
        'avatar',
        'roles',
        'emailVerified',
        'createdAt',
      ],
    });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return user;
  }
}
