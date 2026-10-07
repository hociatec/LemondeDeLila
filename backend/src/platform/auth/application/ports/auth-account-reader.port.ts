export const AUTH_ACCOUNT_READER = Symbol('AUTH_ACCOUNT_READER');

export type AuthAccount = {
  id: number;
  username: string;
  email: string;
  roles: string[];
  bannedUntil: Date | null;
  password?: string;
};

export interface AuthAccountReader {
  findById(id: number): Promise<AuthAccount | null>;
}
