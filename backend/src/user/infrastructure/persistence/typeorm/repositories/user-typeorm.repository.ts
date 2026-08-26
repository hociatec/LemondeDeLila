import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type FindOptionsSelect } from 'typeorm';
import type { UserModel } from '../../../../domain/models/user.model';
import type {
  CreateUserRecord,
  UserRepository,
} from '../../../../application/ports/user.repository';
import { User } from '../entities/user.entity';

const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  username: true,
  avatar: true,
  preferences: true,
  roles: true,
  emailVerified: true,
  bannedUntil: true,
  banReason: true,
  chatBannedUntil: true,
  chatBanReason: true,
  createdAt: true,
} satisfies FindOptionsSelect<User>;

@Injectable()
export class UserTypeormRepository implements UserRepository {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async listPublic(): Promise<UserModel[]> {
    const items = await this.users.find({
      select: PUBLIC_USER_SELECT,
      order: { id: 'ASC' },
    });
    return items.map((item) => this.toPublicModel(item));
  }

  async listStaff(): Promise<UserModel[]> {
    const items = await this.users.find({
      select: PUBLIC_USER_SELECT,
      order: { id: 'ASC' },
    });
    return items
      .map((item) => this.toPublicModel(item))
      .filter((item) => {
        const roles = Array.isArray(item.roles) ? item.roles : [];
        return (
          roles.includes('ROLE_ADMIN') ||
          roles.includes('admin') ||
          roles.includes('ROLE_MODERATOR') ||
          roles.includes('moderator')
        );
      });
  }

  async findPublicById(id: number): Promise<UserModel | null> {
    const user = await this.users.findOne({
      where: { id },
      select: PUBLIC_USER_SELECT,
    });
    return user ? this.toPublicModel(user) : null;
  }

  async findById(id: number): Promise<UserModel | null> {
    const user = await this.users.findOne({ where: { id } });
    return user ? this.toModel(user) : null;
  }

  async findByUsername(username: string): Promise<UserModel | null> {
    const user = await this.users.findOne({ where: { username } });
    return user ? this.toModel(user) : null;
  }

  async existsByUsername(username: string): Promise<boolean> {
    return (await this.users.count({ where: { username } })) > 0;
  }

  async existsByEmail(email: string): Promise<boolean> {
    return (await this.users.count({ where: { email } })) > 0;
  }

  async create(record: CreateUserRecord): Promise<UserModel> {
    const entity = this.users.create({
      email: record.email,
      roles: record.roles,
      password: record.password,
      username: record.username,
      avatar: record.avatar,
      preferences: record.preferences,
      emailVerified: record.emailVerified,
      bannedUntil: record.bannedUntil,
      banReason: record.banReason,
      chatBannedUntil: record.chatBannedUntil,
      chatBanReason: record.chatBanReason,
    });
    const saved = await this.users.save(entity);
    return this.toModel(saved);
  }

  async save(user: UserModel): Promise<UserModel> {
    const saved = await this.users.save({
      id: user.id,
      email: user.email,
      roles: user.roles,
      password: user.password ?? '',
      username: user.username,
      avatar: user.avatar,
      preferences: user.preferences,
      emailVerified: user.emailVerified,
      bannedUntil: user.bannedUntil,
      banReason: user.banReason,
      chatBannedUntil: user.chatBannedUntil,
      chatBanReason: user.chatBanReason,
      createdAt: user.createdAt ?? undefined,
    });
    return this.toModel(saved);
  }

  private toPublicModel(user: User): UserModel {
    return {
      id: user.id,
      email: user.email,
      roles: Array.isArray(user.roles) ? user.roles : [],
      username: user.username,
      avatar: user.avatar ?? null,
      preferences: user.preferences ?? null,
      emailVerified: Boolean(user.emailVerified),
      bannedUntil: user.bannedUntil ?? null,
      banReason: user.banReason ?? null,
      chatBannedUntil: user.chatBannedUntil ?? null,
      chatBanReason: user.chatBanReason ?? null,
      createdAt: user.createdAt ?? null,
      password: null,
    };
  }

  private toModel(user: User): UserModel {
    return {
      ...this.toPublicModel(user),
      password: user.password ?? null,
    };
  }
}
