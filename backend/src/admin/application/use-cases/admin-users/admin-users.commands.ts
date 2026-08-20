export interface ListAdminUsersQuery {
  search?: string;
  role?: string;
  status?: 'all' | 'active' | 'banned';
  createdAfter?: string;
  createdBefore?: string;
  page?: number;
  limit?: number;
}

export interface CreateAdminUserCommand {
  email: string;
  username: string;
  password?: string;
  roles?: string[];
  avatar?: string | null;
  emailVerified?: boolean;
}

export interface UpdateAdminUserCommand {
  email?: string;
  username?: string;
  password?: string;
  roles?: string[];
  avatar?: string | null;
  emailVerified?: boolean;
  bannedUntil?: string | null;
  banReason?: string | null;
}
