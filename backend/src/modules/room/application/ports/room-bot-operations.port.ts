export const ROOM_BOT_OPERATIONS_PORT = Symbol('ROOM_BOT_OPERATIONS_PORT');

export interface RoomBotOperationsPort {
  addSystemBot(roomId: number): Promise<void>;
  removeAll(roomId: number): Promise<void>;
}
