export const REFRESH_TOKEN_SERVICE = Symbol('REFRESH_TOKEN_SERVICE');

export type RefreshTokenRotation = {
  refreshToken: string;
  userId: number;
};

export interface RefreshTokenServicePort {
  issue(userId: number): Promise<string>;
  rotate(refreshToken: string): Promise<RefreshTokenRotation | null>;
  revoke(refreshToken: string): Promise<void>;
}
