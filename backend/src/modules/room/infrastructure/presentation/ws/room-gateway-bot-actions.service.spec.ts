import { RoomGatewayBotActionsService } from './room-gateway-bot-actions.service';
import { RoomGatewayPresenter } from './room-gateway.presenter';
import { baseRoomPayload } from './tests/room.gateway.fixture';

describe('RoomGatewayBotActionsService', () => {
  const bot = { id: 12, name: 'Snowbell' };

  function harness(cacheUpdated = true) {
    const addBot = { execute: jest.fn().mockResolvedValue(bot) };
    const removeBot = { execute: jest.fn().mockResolvedValue(bot) };
    const roomState = {
      invalidateRoomPayloadCache: jest.fn().mockResolvedValue(undefined),
    };
    const context = {
      broadcast: jest.fn().mockResolvedValue(undefined),
      sendRoomState: jest.fn().mockResolvedValue(undefined),
      tryUpdateRoomPayload: jest.fn(async (_roomId, updater) => {
        if (!cacheUpdated) return false;
        updater(baseRoomPayload());
        return true;
      }),
    };
    const perf = {
      measure: jest.fn(async (_name, operation) => operation()),
    };
    const service = new RoomGatewayBotActionsService(
      addBot as never,
      {} as never,
      removeBot as never,
      perf as never,
      roomState as never,
      new RoomGatewayPresenter(),
    );
    return { service, context, roomState };
  }

  it('makes the bot visible to room reads before announcing it', async () => {
    const { service, context } = harness();

    await service.add(
      context as never,
      { roomId: 10, userId: 1 } as never,
      {},
      Date.now(),
    );

    expect(context.tryUpdateRoomPayload).toHaveBeenCalledWith(
      10,
      expect.any(Function),
    );
    expect(context.broadcast).toHaveBeenCalledWith(10, 'bot.added', {
      roomId: 10,
      bot,
    });
    expect(
      context.tryUpdateRoomPayload.mock.invocationCallOrder[0],
    ).toBeLessThan(context.broadcast.mock.invocationCallOrder[0]);
  });

  it('reloads a missing cache before announcing the bot', async () => {
    const { service, context, roomState } = harness(false);

    await service.add(
      context as never,
      { roomId: 10, userId: 1 } as never,
      {},
      Date.now(),
    );

    expect(roomState.invalidateRoomPayloadCache).toHaveBeenCalledWith(10);
    expect(context.sendRoomState).toHaveBeenCalledWith(10);
    expect(context.sendRoomState.mock.invocationCallOrder[0]).toBeLessThan(
      context.broadcast.mock.invocationCallOrder[0],
    );
  });
});
