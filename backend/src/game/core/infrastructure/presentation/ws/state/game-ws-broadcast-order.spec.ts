import { GameWsRealtimeStateService } from './game-ws-realtime-state.service';
import type { GameRuntime } from '../../../../application/ports/game-runtime.port';

function fixture() {
  const connections = [
    {
      connectionId: 'connection:4:lama',
      meta: { scope: 'game', roomId: 4, gameType: 'lama', userId: 1 },
    },
  ];
  const presenter = {
    present: jest.fn((input) => ({
      runId: input.state.metadata.roomRunId,
      version: input.version,
    })),
  };
  const hub = {
    listConnections: () => connections,
    send: jest
      .fn<boolean, [string, { payload: { runId: number; version: number } }]>()
      .mockReturnValue(true),
  };
  const service = new GameWsRealtimeStateService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    presenter as never,
    hub as never,
    {} as never,
    {} as never,
  );
  const publish = (runId: number, version: number, gameType = 'lama') =>
    service['broadcast'](
      4,
      gameType,
      {
        status: 'started',
        phase: 'playing',
        log: [],
        metadata: { roomRunId: runId },
        version,
      },
      {} as GameRuntime,
      version,
    );
  return { connections, presenter, hub, service, publish };
}

it('accepts a new run at version one and rejects delayed states of an older run', () => {
  const { publish, hub } = fixture();
  publish(1, 100);
  publish(2, 1);
  publish(1, 101);
  publish(2, 3);
  publish(2, 2);
  expect(hub.send.mock.calls.map(([, message]) => message.payload)).toEqual([
    { runId: 1, version: 100 },
    { runId: 2, version: 1 },
    { runId: 2, version: 3 },
  ]);
});

it('records a version only after the presentation and send complete', () => {
  const { publish, presenter, hub } = fixture();
  presenter.present.mockImplementationOnce(() => {
    throw new Error('projection');
  });
  expect(() => publish(1, 5)).toThrow('projection');
  publish(1, 4);
  hub.send.mockImplementationOnce(() => {
    throw new Error('transport');
  });
  expect(() => publish(1, 9)).toThrow('transport');
  publish(1, 8);
  expect(hub.send.mock.calls.at(-1)?.[1].payload.version).toBe(8);
});

it('drops disconnected connection history on the next broadcast', () => {
  const { publish, connections, service } = fixture();
  publish(1, 10);
  connections.length = 0;
  publish(1, 11);
  expect(service['latestSentVersions'].size).toBe(0);
});

it('does not record a transport refusal as a sent state', () => {
  const { publish, hub, service } = fixture();
  hub.send.mockReturnValueOnce(false);
  publish(1, 10);
  expect(service['latestSentVersions'].size).toBe(0);
  publish(1, 9);
  expect(service['latestSentVersions'].size).toBe(1);
  expect(hub.send).toHaveBeenCalledTimes(2);
});

it('clears only the exact game identity even when connection IDs contain delimiters', () => {
  const { publish, connections, service, hub } = fixture();
  connections[0].meta.gameType = 'lama-plus';
  publish(1, 10, 'lama-plus');
  service['clearSentVersions'](4, 'lama');
  publish(1, 9, 'lama-plus');
  expect(hub.send).toHaveBeenCalledTimes(1);
  service['clearSentVersions'](4, 'lama-plus');
  publish(1, 1, 'lama-plus');
  expect(hub.send).toHaveBeenCalledTimes(2);
});
