export type RoomInvite = {
  id: string;
  roomId: number;
  fromUserId: number;
  toUserId: number;
  createdAt: number;
  expiresAt: number;
  consumedAt?: number | null;
};
