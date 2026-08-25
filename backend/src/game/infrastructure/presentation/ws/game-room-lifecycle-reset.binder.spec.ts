import { GameRoomLifecycleResetBinder } from './game-room-lifecycle-reset.binder';

describe('GameRoomLifecycleResetBinder', () => {
  it('clears game state on room reset and deletion only', async () => {
    let lobbyChanged:
      | ((roomId: number, reason: string) => Promise<void> | void)
      | undefined;
    let roomDeleted: ((roomId: number) => Promise<void> | void) | undefined;
    const roomEvents = {
      onLobbyChanged: jest.fn((listener) => {
        lobbyChanged = listener;
      }),
      onRoomDeleted: jest.fn((listener) => {
        roomDeleted = listener;
      }),
    };
    const realtime = { clearRoom: jest.fn().mockResolvedValue(undefined) };
    const binder = new GameRoomLifecycleResetBinder(
      roomEvents as never,
      realtime as never,
    );
    binder.onModuleInit();

    await lobbyChanged!(4, 'started');
    expect(realtime.clearRoom).not.toHaveBeenCalled();

    await lobbyChanged!(4, 'reset');
    await roomDeleted!(5);
    expect(realtime.clearRoom).toHaveBeenNthCalledWith(1, 4);
    expect(realtime.clearRoom).toHaveBeenNthCalledWith(2, 5);
  });
});
