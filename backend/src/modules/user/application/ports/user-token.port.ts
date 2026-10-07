export type UserTokenPayload = {
  id: number;
  email: string;
  roles: string[];
  username: string;
};

export interface UserTokenServicePort {
  sign(payload: UserTokenPayload): string;
}

export const USER_TOKEN_SERVICE = Symbol('USER_TOKEN_SERVICE');
