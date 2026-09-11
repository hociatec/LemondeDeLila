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
    const offsetInput = options.offset ?? 0;
    const limitInput = options.limit ?? 50;
    const offset = Number.isSafeInteger(offsetInput)
      ? Math.min(10_000_000, Math.max(0, offsetInput))
      : 0;
    const limit = Number.isSafeInteger(limitInput)
      ? Math.max(1, Math.min(100, limitInput))
      : 50;
    return this.users.listPublic({ offset, limit });
  }
}
