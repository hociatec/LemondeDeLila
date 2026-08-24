import type { UserModel } from '../../domain/models/user.model';

export type CreateUserRecord = {
  email: string;
  roles: string[];
  username: string;
  avatar: string | null;
  preferences: Record<string, unknown> | null;
  emailVerified: boolean;
  bannedUntil: Date | null;
  banReason: string | null;
  chatBannedUntil: Date | null;
  chatBanReason: string | null;
  password: string;
};

export interface UserRepository {
  listPublic(): Promise<UserModel[]>;
  listStaff(): Promise<UserModel[]>;
  findPublicById(id: number): Promise<UserModel | null>;
  findById(id: number): Promise<UserModel | null>;
  findByUsername(username: string): Promise<UserModel | null>;
  existsByUsername(username: string): Promise<boolean>;
  existsByEmail(email: string): Promise<boolean>;
  create(record: CreateUserRecord): Promise<UserModel>;
  save(user: UserModel): Promise<UserModel>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
