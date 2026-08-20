import type { AdminSafeUser, AdminUser } from '../../domain/models/admin-user.model';

export const ADMIN_USER_REPOSITORY = Symbol('ADMIN_USER_REPOSITORY');

export type ListAdminUsersFilters = {
  search?: string;
  role?: string;
  status?: 'all' | 'active' | 'banned';
  createdAfter?: Date | null;
  createdBefore?: Date | null;
  page: number;
  limit: number;
};

export interface AdminUserRepository {
  clearExpiredBans(now: Date): Promise<void>;
  clearExpiredChatBans(now: Date): Promise<void>;
  list(filters: ListAdminUsersFilters): Promise<{
    items: AdminSafeUser[];
    total: number;
  }>;
  findById(id: number): Promise<AdminUser | null>;
  findSafeById(id: number): Promise<AdminSafeUser | null>;
  findByEmail(email: string): Promise<AdminUser | null>;
  findByUsername(username: string): Promise<AdminUser | null>;
  create(data: Omit<AdminUser, 'id' | 'createdAt'>): Promise<AdminUser>;
  save(user: AdminUser): Promise<AdminUser>;
  delete(id: number): Promise<void>;
}
