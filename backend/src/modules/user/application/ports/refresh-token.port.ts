export const REFRESH_TOKEN_SERVICE = Symbol('REFRESH_TOKEN_SERVICE');

export type RefreshTokenRotation = {
  refreshToken: string;
  userId: number;
  credentialVersion?: string;
};

export interface RefreshTokenServicePort {
  issue(userId: number, credentialVersion?: string): Promise<string>;
  inspect(
    refreshToken: string,
  ): Promise<Omit<RefreshTokenRotation, 'refreshToken'> | null>;
  rotate(refreshToken: string): Promise<RefreshTokenRotation | null>;
  revoke(refreshToken: string): Promise<void>;
  revokeAllForUser?(userId: number): Promise<void>;
}
