/** Room columns required by participant/bot queries, without inverse collections. */
export type RoomPersistenceRef = {
  id: number;
  gameType: string;
  name: string;
  status: string;
  startedAt?: Date | null;
};
