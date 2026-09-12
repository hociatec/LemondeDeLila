import { WebSocket } from 'ws';
import { RoomSocketHeartbeat } from './room-heartbeat.helpers';

afterEach(() => jest.useRealTimers());

it.each([-86400000, 86400000])(
  'ignores a wall-clock jump of %s ms while detecting a missing pong',
  (shift) => {
    jest.useFakeTimers({ now: 100000000 });
    const socket: unknown = Reflect.construct(WebSocket, [null, undefined, {}]);
    if (!(socket instanceof WebSocket))
      throw new Error('Invalid server socket fixture');
    Object.defineProperty(socket, 'readyState', { value: WebSocket.OPEN });
    jest.spyOn(socket, 'ping').mockImplementation(() => undefined);
    const terminate = jest
      .spyOn(socket, 'terminate')
      .mockImplementation(() => undefined);
    const heartbeat = new RoomSocketHeartbeat(1000);
    heartbeat.start(socket);
    jest.setSystemTime(Date.now() + shift);
    jest.advanceTimersByTime(1000);
    expect(terminate).not.toHaveBeenCalled();
    jest.advanceTimersByTime(2000);
    expect(terminate).toHaveBeenCalledTimes(1);
    expect(heartbeat.size).toBe(0);
    expect(socket.listenerCount('pong')).toBe(0);
  },
);
