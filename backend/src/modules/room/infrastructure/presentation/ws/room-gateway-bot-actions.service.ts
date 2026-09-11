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
import { PerfMetricsService } from '../../../../../platform/observability/public-api';
import { RoomStateService } from '../../../application/services/state/room-state.service';
import { RoomWsNoBotToRemoveError } from './room-ws.errors';
import { parseStrictInteger } from '@shared/utils/public-api';
import type { ActionsContext } from './room-gateway-actions.types';
import { extractTraceMeta } from './room-command.helpers';
import { RoomGatewayPresenter } from './room-gateway.presenter';
import type { AuthedClient } from './room-gateway.types';

function mapBotError(error: unknown): unknown {
  if (!(error instanceof BotApplicationError)) {
    return new BadRequestException('Action bot impossible');
  }
  const message = error.message.slice(0, 512);
  switch (error.code) {
    case 'BOT_ROOM_NOT_FOUND':
    case 'BOT_NOT_FOUND':
      return new NotFoundException(message);
    case 'BOT_ROOM_OWNER_REQUIRED':
      return new UnauthorizedException(message);
    default:
      return new BadRequestException(message);
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
        const updated = await context.tryUpdateRoomPayload(
          meta.roomId,
          (room) => this.presenter.updateRoomPayloadWithAddedBot(room, bot),
        );
        if (!updated) {
          await this.roomState.invalidateRoomPayloadCache(meta.roomId);
          await context.sendRoomState(meta.roomId);
        }
        // The announcement is an observable readiness signal for clients: an
        // owner can start the game as soon as it is received. Publish it only
        // after every subsequent room read is guaranteed to include the bot.
        await context.broadcast(
          meta.roomId,
          'bot.added',
          this.presenter.presentBotAdded(meta.roomId, bot),
        );
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
        const requestedId = row.botId ?? row.id;
        let botId = parseStrictInteger(requestedId, { min: 1 });
        if (requestedId != null && botId === null) {
          throw new BadRequestException('Identifiant de bot invalide');
        }
        if (botId === null) {
          const last = await this.getLastBot.execute(meta.roomId);
          if (!last?.id) {
            throw new RoomWsNoBotToRemoveError();
          }
          botId = last.id;
        }
        let bot;
        try {
          bot = await this.removeBot.execute(meta.roomId, meta.userId, botId);
        } catch (error) {
          throw mapBotError(error);
        }
        const updated = await context.tryUpdateRoomPayload(
          meta.roomId,
          (room) =>
            this.presenter.updateRoomPayloadWithRemovedBot(room, bot.id),
        );
        if (!updated) {
          await this.roomState.invalidateRoomPayloadCache(meta.roomId);
          await context.sendRoomState(meta.roomId);
        }
        await context.broadcast(
          meta.roomId,
          'bot.removed',
          this.presenter.presentBotRemoved(meta.roomId, bot, botId),
        );
      },
      { roomId: meta.roomId, userId: meta.userId, ...trace },
    );
  }
}
