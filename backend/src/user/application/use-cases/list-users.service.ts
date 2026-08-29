import { Inject, Injectable } from '@nestjs/common';
import type { UserModel } from '../../domain/models/user.model';
import { USER_REPOSITORY, type UserRepository } from '../ports/user.repository';

@Injectable()
export class ListUsersService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async execute(
    options: { offset?: number; limit?: number } = {},
  ): Promise<UserModel[]> {
    const offset = Math.max(0, Math.trunc(options.offset ?? 0));
    const limit = Math.max(1, Math.min(100, Math.trunc(options.limit ?? 50)));
    return this.users.listPublic({ offset, limit });
  }
}
