export interface AdminUser {
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
}

export type AdminSafeUser = Omit<AdminUser, 'password'>;
