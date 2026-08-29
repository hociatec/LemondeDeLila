import { WebSocket } from 'ws';
import { PresenceHeartbeat } from './presence-heartbeat';

describe('PresenceHeartbeat', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('rafraîchit la présence après avoir pingé les sockets ouvertes', () => {
    const socket = {
      readyState: WebSocket.OPEN,
      ping: jest.fn(),
      once: jest.fn((_event, listener: () => void) => listener()),
    } as unknown as WebSocket;
    const refreshPresence = jest.fn();
    const heartbeat = new PresenceHeartbeat(
      {
        listSockets: () => [socket],
        unregister: jest.fn(),
        refreshPresence,
      },
      50,
      10,
    );

    heartbeat.ensureStarted();
    jest.advanceTimersByTime(50);

    expect(socket.ping).toHaveBeenCalledTimes(1);
    expect(refreshPresence).toHaveBeenCalledTimes(1);
    heartbeat.stop();
  });

  it('retire et termine une socket sans pong', () => {
    const socket = {
      readyState: WebSocket.OPEN,
      ping: jest.fn(),
      once: jest.fn(),
      terminate: jest.fn(),
    } as unknown as WebSocket;
    const unregister = jest.fn();
    const heartbeat = new PresenceHeartbeat(
      {
        listSockets: () => [socket],
        unregister,
        refreshPresence: jest.fn(),
      },
      50,
      10,
    );

    heartbeat.ensureStarted();
    jest.advanceTimersByTime(60);

    expect(unregister).toHaveBeenCalledWith(socket);
    expect(socket.terminate).toHaveBeenCalledTimes(1);
    heartbeat.stop();
  });
});
