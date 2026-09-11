import type { UserId } from '../../../../shared/interfaces/public-api';

/** Stable cross-module identity projection; never contains credentials or bans. */
export type UserRef = {
  id: UserId;
  username: string;
  roles: string[];
};
