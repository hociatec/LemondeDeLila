/** Minimal user projection held by social persistence relations. */
export type SocialUserPersistenceRef = {
  id: number;
  username: string;
  avatar?: string | null;
};
