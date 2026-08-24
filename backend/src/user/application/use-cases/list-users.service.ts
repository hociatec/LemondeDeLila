import { Inject, Injectable } from '@nestjs/common';
import type { UserModel } from '../../domain/models/user.model';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../ports/user.repository';

@Injectable()
export class ListUsersService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async execute(): Promise<UserModel[]> {
    return this.users.listPublic();
  }
}
