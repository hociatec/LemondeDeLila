import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import { RoomSocketHeartbeat } from './room-heartbeat.helpers';
import { RoomGatewayRuntimeStateService } from './room-gateway-runtime-state.service';

describe('room realtime resource cleanup', () => {
  afterEach(() => jest.useRealTimers());

  it('does not accumulate pong listeners over reconnect cycles', () => {
    jest.useFakeTimers();
    const heartbeat = new RoomSocketHeartbeat(1000);
    const socket = new EventEmitter() as unknown as WebSocket;
    Object.assign(socket, { readyState: WebSocket.OPEN, ping: jest.fn() });

    for (let cycle = 0; cycle < 100; cycle += 1) {
      heartbeat.start(socket);
      heartbeat.stop(socket);
    }

    expect(heartbeat.size).toBe(0);
    expect((socket as unknown as EventEmitter).listenerCount('pong')).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('clears maps, timers and listeners when the module stops', () => {
    jest.useFakeTimers();
    const presenter = {} as ConstructorParameters<
      typeof RoomGatewayRuntimeStateService
    >[0];
    const runtime = new RoomGatewayRuntimeStateService(presenter);
    const socket = new EventEmitter() as unknown as WebSocket;
    const close = jest.fn();
    const terminate = jest.fn();
    Object.assign(socket, {
      readyState: WebSocket.OPEN,
      ping: jest.fn(),
      close,
      terminate,
    });
    runtime.clients.set(socket, {} as never);
    runtime.rooms.set(1, new Set([socket]));
    runtime.heartbeat.start(socket);
    runtime.pendingParticipantLeaves.set(
      '1:1',
      setTimeout(jest.fn(), 1000) as unknown as ReturnType<typeof setTimeout>,
    );

    runtime.onModuleDestroy();

    expect(runtime.clients.size).toBe(0);
    expect(runtime.rooms.size).toBe(0);
    expect(runtime.pendingParticipantLeaves.size).toBe(0);
    expect(runtime.heartbeat.size).toBe(0);
    expect((socket as unknown as EventEmitter).listenerCount('pong')).toBe(0);
    expect(close).toHaveBeenCalledWith(1001, 'Server shutdown');
    jest.advanceTimersByTime(1_000);
    expect(terminate).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});
