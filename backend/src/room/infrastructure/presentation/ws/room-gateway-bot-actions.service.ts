import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AddBotToRoomService,
  BotApplicationError,
  GetLastRoomBotService,
  RemoveBotFromRoomService,
} from '../../../../bot/public-api';
import { PerfMetricsService } from '../../../../common/observability/public-api';
import { RoomStateService } from '../../../application/services/room-state.service';
import { RoomWsNoBotToRemoveError } from '../../../domain/errors/room-ws.errors';
import type { ActionsContext } from './room-gateway-actions.service';
import { extractTraceMeta } from './room-command.helpers';
import { RoomGatewayPresenter } from './room-gateway.presenter';
import type { AuthedClient } from './room-gateway.types';

function mapBotError(error: unknown): unknown {
  if (!(error instanceof BotApplicationError)) {
    return error;
  }
  switch (error.code) {
    case 'BOT_ROOM_NOT_FOUND':
    case 'BOT_NOT_FOUND':
      return new NotFoundException(error.message);
    case 'BOT_ROOM_OWNER_REQUIRED':
      return new UnauthorizedException(error.message);
    default:
      return new BadRequestException(error.message);
  }
}

@Injectable()
export class RoomGatewayBotActionsService {
  constructor(
    private readonly addBot: AddBotToRoomService,
    private readonly getLastBot: GetLastRoomBotService,
    private readonly removeBot: RemoveBotFromRoomService,
    private readonly perf: PerfMetricsService,
    private readonly roomState: RoomStateService,
    private readonly presenter: RoomGatewayPresenter,
  ) {}

  async add(
    context: ActionsContext,
    meta: AuthedClient,
    payload: unknown,
    receivedAtMs: number,
  ): Promise<void> {
    const trace = extractTraceMeta(payload, receivedAtMs);
    await this.perf.measure(
      'ws.room.bot.add.total',
      async () => {
        let bot;
        try {
          bot = await this.addBot.execute(meta.roomId, meta.userId);
        } catch (error) {
          throw mapBotError(error);
        }
        await context.broadcast(
          meta.roomId,
          'bot.added',
          this.presenter.presentBotAdded(meta.roomId, bot),
        );
        const updated = await context.tryUpdateRoomPayload(
          meta.roomId,
          (room) => this.presenter.updateRoomPayloadWithAddedBot(room, bot),
        );
        if (!updated) {
          await this.roomState.invalidateRoomPayloadCache(meta.roomId);
          await context.sendRoomState(meta.roomId);
        }
      },
      { roomId: meta.roomId, userId: meta.userId, ...trace },
    );
  }

  async remove(
    context: ActionsContext,
    meta: AuthedClient,
    payload: unknown,
    receivedAtMs: number,
  ): Promise<void> {
    const trace = extractTraceMeta(payload, receivedAtMs);
    await this.perf.measure(
      'ws.room.bot.remove.total',
      async () => {
        const row = context.asRecord(payload);
        let botId = Number(row.botId ?? row.id ?? -1);
        if (!Number.isFinite(botId) || botId <= 0) {
          const last = await this.getLastBot.execute(meta.roomId);
          if (!last?.id) {
            throw new RoomWsNoBotToRemoveError();
          }
          botId = Number(last.id);
        }
        let bot;
        try {
          bot = await this.removeBot.execute(meta.roomId, meta.userId, botId);
        } catch (error) {
          throw mapBotError(error);
        }
        await context.broadcast(
          meta.roomId,
          'bot.removed',
          this.presenter.presentBotRemoved(meta.roomId, bot, botId),
        );
        const updated = await context.tryUpdateRoomPayload(
          meta.roomId,
          (room) =>
            this.presenter.updateRoomPayloadWithRemovedBot(room, bot.id),
        );
        if (!updated) {
          await this.roomState.invalidateRoomPayloadCache(meta.roomId);
          await context.sendRoomState(meta.roomId);
        }
      },
      { roomId: meta.roomId, userId: meta.userId, ...trace },
    );
  }
}
