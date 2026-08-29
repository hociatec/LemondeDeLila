export const VAULT_USER_NOTIFIER = Symbol('VAULT_USER_NOTIFIER');

export interface VaultUserNotifier {
  notifyRoomRestoreReady(input: {
    userId: number;
    roomId: number;
    roomName: string;
    ownerUserId: number;
  }): Promise<void>;
}
