export const ROOM_BOT_COUNTER_PORT = Symbol('ROOM_BOT_COUNTER_PORT');

export interface RoomBotCounterPort {
  execute(roomId: number): Promise<number>;
}
