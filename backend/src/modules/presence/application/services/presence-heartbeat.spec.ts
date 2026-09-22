import { WebSocket } from 'ws';
import { PresenceHeartbeat } from './presence-heartbeat';

describe('PresenceHeartbeat', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  function trackedSocket() {
    // The server-side ws constructor needs options absent from its null overload.
    const socket: WebSocket = Reflect.construct(WebSocket, [
      null,
      undefined,
      { autoPong: true, closeTimeout: 1000 },
    ]);
    Object.defineProperty(socket, 'readyState', { value: WebSocket.OPEN });
    const ping = jest.spyOn(socket, 'ping').mockImplementation(() => {});
    const terminate = jest
      .spyOn(socket, 'terminate')
      .mockImplementation(() => {});
    const unregister = jest.fn();
    const heartbeat = new PresenceHeartbeat(
      {
        listSockets: () => [socket],
        unregister,
        refreshPresence: jest.fn(),
      },
      5_000,
      1_000,
    );
    heartbeat.ensureStarted();
    return { socket, ping, terminate, unregister, heartbeat };
  }

  it('cancels pending deadlines and listeners on shutdown', () => {
    const { socket, terminate, unregister, heartbeat } = trackedSocket();
    jest.advanceTimersByTime(5_000);
    expect(socket.listenerCount('pong')).toBe(1);
    heartbeat.stop();
    expect(socket.listenerCount('pong')).toBe(0);
    expect(socket.listenerCount('close')).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(10_000);
    expect(terminate).not.toHaveBeenCalled();
    expect(unregister).not.toHaveBeenCalled();
  });

  it('registers pong listeners before sending the ping', () => {
    const { socket, ping, terminate, heartbeat } = trackedSocket();
    ping.mockImplementation(() => {
      socket.emit('pong', Buffer.alloc(0));
    });
    jest.advanceTimersByTime(6_000);
    expect(terminate).not.toHaveBeenCalled();
    expect(socket.listenerCount('pong')).toBe(0);
    expect(socket.listenerCount('close')).toBe(0);
    heartbeat.stop();
  });

  it.each(['cancel', 'close'])('removes pending work on socket %s', (event) => {
    const { socket, terminate, unregister, heartbeat } = trackedSocket();
    jest.advanceTimersByTime(5_000);
    if (event === 'cancel') heartbeat.cancel(socket);
    else socket.emit('close');
    jest.advanceTimersByTime(1_000);
    expect(terminate).not.toHaveBeenCalled();
    expect(unregister).not.toHaveBeenCalled();
    expect(socket.listenerCount('pong')).toBe(0);
    heartbeat.stop();
  });

  it('rafraîchit la présence après avoir pingé les sockets ouvertes', () => {
    const socket = {
      readyState: WebSocket.OPEN,
      ping: jest.fn(),
      once: jest.fn((_event, listener: () => void) => listener()),
      off: jest.fn(),
    } as unknown as WebSocket;
    const refreshPresence = jest.fn();
    const heartbeat = new PresenceHeartbeat(
      {
        listSockets: () => [socket],
        unregister: jest.fn(),
        refreshPresence,
      },
      5_000,
      1_000,
    );

    heartbeat.ensureStarted();
    jest.advanceTimersByTime(5_000);

    expect(socket.ping).toHaveBeenCalledTimes(1);
    expect(refreshPresence).toHaveBeenCalledTimes(1);
    heartbeat.stop();
  });

  it('retire et termine une socket sans pong', () => {
    const socket = {
      readyState: WebSocket.OPEN,
      ping: jest.fn(),
      once: jest.fn(),
      off: jest.fn(),
      terminate: jest.fn(),
    } as unknown as WebSocket;
    const unregister = jest.fn();
    const heartbeat = new PresenceHeartbeat(
      {
        listSockets: () => [socket],
        unregister,
        refreshPresence: jest.fn(),
      },
      5_000,
      1_000,
    );

    heartbeat.ensureStarted();
    jest.advanceTimersByTime(6_000);

    expect(unregister).toHaveBeenCalledWith(socket);
    expect(socket.terminate).toHaveBeenCalledTimes(1);
    heartbeat.stop();
  });

  it('clamps sub-second configuration and keeps the timeout within the interval', () => {
    const listSockets = jest.fn(() => []);
    const heartbeat = new PresenceHeartbeat(
      { listSockets, unregister: jest.fn(), refreshPresence: jest.fn() },
      1,
      1,
    );
    heartbeat.ensureStarted();
    jest.advanceTimersByTime(999);
    expect(listSockets).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(listSockets).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});
