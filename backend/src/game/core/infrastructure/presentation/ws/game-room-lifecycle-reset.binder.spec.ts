import { GameRoomLifecycleResetBinder } from './game-room-lifecycle-reset.binder';

describe('GameRoomLifecycleResetBinder', () => {
  it('requests reconciliation on reset and deletion without blindly clearing a room', async () => {
    let lobbyChanged:
      ((roomId: number, reason: string) => Promise<void> | void) | undefined;
    let roomDeleted: ((roomId: number) => Promise<void> | void) | undefined;
    const roomEvents = {
      onLobbyChanged: jest.fn((listener) => {
        lobbyChanged = listener;
      }),
      onRoomDeleted: jest.fn((listener) => {
        roomDeleted = listener;
      }),
    };
    const recovery = { recover: jest.fn().mockResolvedValue(undefined) };
    const binder = new GameRoomLifecycleResetBinder(roomEvents, recovery);
    binder.onModuleInit();

    await lobbyChanged!(4, 'started');
    expect(recovery.recover).not.toHaveBeenCalled();

    await lobbyChanged!(4, 'reset');
    await roomDeleted!(5);
    expect(recovery.recover).toHaveBeenNthCalledWith(1);
    expect(recovery.recover).toHaveBeenNthCalledWith(2);
  });
});
