import { RoomLobbyRefreshService } from './room-lobby-refresh.service';

describe('lobby refresh lifetime', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('coalesces refreshes while active', () => {
    const send = jest.fn(() => true);
    const service = new RoomLobbyRefreshService({ send });
    service.subscribe('connection');
    service.notifyRefresh(1, 'join');
    service.notifyRefresh(1, 'leave');
    jest.advanceTimersByTime(250);
    expect(send).toHaveBeenCalledTimes(1);
    service.onModuleDestroy();
  });

  it('cancels pending refreshes and ignores late domain callbacks after destruction', () => {
    const send = jest.fn(() => true);
    const service = new RoomLobbyRefreshService({ send });
    service.subscribe('connection');
    service.notifyRefresh(1, 'join');
    expect(jest.getTimerCount()).toBe(1);
    service.onModuleDestroy();
    service.onModuleDestroy();
    service.subscribe('late');
    service.notifyRefresh(1, 'late');
    expect(jest.getTimerCount()).toBe(0);
    jest.runAllTimers();
    expect(send).not.toHaveBeenCalled();
  });
});
