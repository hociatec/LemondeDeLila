/** Extensible client-owned JSON; version this contract once it gains server semantics. */
export type UserPreferences = Record<string, unknown>;

export type UserModel = {
  id: number;
  email: string;
  roles: string[];
  username: string;
  avatar: string | null;
  preferences: UserPreferences | null;
  bannedUntil: Date | null;
  banReason: string | null;
  chatBannedUntil: Date | null;
  chatBanReason: string | null;
  createdAt: Date | null;
  password: string | null;
};
