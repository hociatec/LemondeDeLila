export const USER_ADMINISTRATION_PORT = Symbol('USER_ADMINISTRATION_PORT');

export type UserAdministrationRecord = {
  id: number;
  email: string;
  username: string;
  password?: string;
  avatar: string | null;
  roles: string[];
  bannedUntil: Date | null;
  banReason: string | null;
  chatBannedUntil: Date | null;
  chatBanReason: string | null;
  createdAt: Date | null;
};

export type UserAdministrationSafeRecord = Omit<
  UserAdministrationRecord,
  'password'
>;

export type UserAdministrationFilters = {
  search?: string;
  role?: string;
  status?: 'all' | 'active' | 'banned';
  createdAfter?: Date | null;
  createdBefore?: Date | null;
  page: number;
  limit: number;
};

export interface UserAdministrationPort {
  clearExpiredBans(now: Date): Promise<void>;
  clearExpiredChatBans(now: Date): Promise<void>;
  scanIdBatches(): AsyncIterable<readonly number[]>;
  list(filters: UserAdministrationFilters): Promise<{
    items: UserAdministrationSafeRecord[];
    total: number;
  }>;
  findById(id: number): Promise<UserAdministrationRecord | null>;
  findSafeById(id: number): Promise<UserAdministrationSafeRecord | null>;
  findByEmail(email: string): Promise<UserAdministrationRecord | null>;
  findByUsername(username: string): Promise<UserAdministrationRecord | null>;
  create(
    data: Omit<UserAdministrationRecord, 'id' | 'createdAt'>,
  ): Promise<UserAdministrationRecord>;
  save(user: UserAdministrationRecord): Promise<UserAdministrationRecord>;
  delete(id: number): Promise<void>;
}
