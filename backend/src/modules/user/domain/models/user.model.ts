export type UserModel = {
  id: number;
  email: string;
  roles: string[];
  username: string;
  avatar: string | null;
  preferences: Record<string, unknown> | null;
  bannedUntil: Date | null;
  banReason: string | null;
  chatBannedUntil: Date | null;
  chatBanReason: string | null;
  createdAt: Date | null;
  password: string | null;
};
