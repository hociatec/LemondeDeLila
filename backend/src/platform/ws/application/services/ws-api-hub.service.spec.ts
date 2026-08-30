import type { WsRuntimeConfig } from '../ports/ws-runtime-config.port';
import { WsApiHubService } from './ws-api-hub.service';

const config = {
  maxBufferedBytes: 100,
} as WsRuntimeConfig;

describe('WsApiHubService', () => {
  it('disconnects a slow consumer instead of growing its send buffer', () => {
    const hub = new WsApiHubService(config);
    const socket = {
      readyState: 1,
      bufferedAmount: 101,
      send: jest.fn(),
      close: jest.fn(),
    };
    hub.register('slow', socket);

    expect(hub.send('slow', { type: 'event' })).toBe(false);
    expect(socket.send).not.toHaveBeenCalled();
    expect(socket.close).toHaveBeenCalledWith(1013, 'Client too slow');
    expect(hub.listConnections()).toEqual([]);
  });

  it('closes and clears every owned socket during shutdown', () => {
    jest.useFakeTimers();
    const hub = new WsApiHubService(config);
    const socket = {
      readyState: 1,
      bufferedAmount: 0,
      send: jest.fn(),
      close: jest.fn(),
      terminate: jest.fn(),
    };
    hub.register('active', socket);
    hub.onModuleDestroy();
    expect(socket.close).toHaveBeenCalledWith(1001, 'Server shutdown');
    expect(hub.listConnections()).toEqual([]);
    jest.advanceTimersByTime(1_000);
    expect(socket.terminate).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
