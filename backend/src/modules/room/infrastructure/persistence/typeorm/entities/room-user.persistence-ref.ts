/** Persistence projection used by room relations; it is not the User aggregate. */
export type RoomUserPersistenceRef = {
  id: number;
  username: string;
  roles: string[];
};
