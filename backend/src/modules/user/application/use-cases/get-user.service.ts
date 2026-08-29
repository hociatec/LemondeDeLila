import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { UserModel } from '../../domain/models/user.model';
import { USER_REPOSITORY, type UserRepository } from '../ports/user.repository';

@Injectable()
export class GetUserService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async execute(id: number): Promise<UserModel> {
    const user = await this.users.findPublicById(id);
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return user;
  }
}
