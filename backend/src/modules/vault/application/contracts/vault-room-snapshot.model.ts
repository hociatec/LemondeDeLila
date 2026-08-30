export type VaultRoomSnapshotRecord = {
  id: string;
  ownerUserId: number;
  name: string;
  gameType: string;
  roomName: string;
  playersLabel: string;
  snapshotJson: string;
  createdAt: Date;
};
/** Explicitly named data contract at the application boundary. */
