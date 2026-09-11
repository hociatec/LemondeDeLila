import type { RoomCommandContext } from './room-command-context';
import { WsRequestRateLimitService } from '../../../../../platform/ws/public-api';
import { Inject, Injectable } from '@nestjs/common';
import { WebSocket } from 'ws';
import {
  BUSINESS_CLOCK,
  type BusinessClock,
} from '../../../../../shared/interfaces/public-api';
import {
  normalizeCorrelationId,
  runWithCorrelationId,
} from '../../../../../platform/observability/public-api';
import { extractTraceMeta, isImmediateAckAction } from './room-command.helpers';
import type { ClientMeta, IncomingPayload } from './room-gateway.types';
import { decodeRoomIntent } from './room-intent-decoder';

@Injectable()
export class RoomGatewayCommandService {
  constructor(
    private readonly rateLimit: WsRequestRateLimitService,
    @Inject(BUSINESS_CLOCK) private readonly clock: BusinessClock,
  ) {}

  async handleCommand(
    ctx: RoomCommandContext,
    client: WebSocket,
    meta: ClientMeta,
    payload: IncomingPayload,
  ): Promise<void> {
    const data = payload?.payload ?? {};
    if (!(await this.rateLimit.allow(meta.userId))) {
      ctx.safeSend(client, {
        type: 'error',
        payload: {
          code: 'WS_RATE_LIMITED',
          message: 'Trop de requêtes ou quota indisponible',
        },
      });
      return;
    }
    const receivedAtMs = this.clock.now();
    const trace = extractTraceMeta(ctx.asRecord(data), receivedAtMs);
    await runWithCorrelationId(
      normalizeCorrelationId(trace.traceId),
      async () => {
        await this.handleRoomIntentExecute(
          ctx,
          client,
          meta,
          data,
          receivedAtMs,
        );
      },
    );
  }

  async handleRoomIntentExecute(
    ctx: RoomCommandContext,
    client: WebSocket,
    meta: ClientMeta,
    payload: unknown,
    receivedAtMs: number,
  ): Promise<void> {
    const { intentId, commandPayload } = decodeRoomIntent(
      ctx.asRecord(payload),
    );

    ctx.sendImmediateAckIfNeeded(
      client,
      meta,
      intentId,
      commandPayload,
      receivedAtMs,
    );
    await ctx.executeRoomCommand(
      client,
      meta,
      intentId,
      commandPayload,
      receivedAtMs,
    );
  }

  sendImmediateAckIfNeeded(
    ctx: RoomCommandContext,
    client: WebSocket,
    meta: ClientMeta,
    type: string | undefined,
    payload: unknown,
    receivedAtMs: number,
  ): void {
    if (!isImmediateAckAction(type)) {
      return;
    }

    const trace = extractTraceMeta(payload, receivedAtMs);
    ctx.safeSend(client, {
      type: 'room.ack',
      roomId: meta.roomId,
      payload: {
        action: type,
        traceId: trace.traceId,
        receivedAtMs,
        clientToServerMs: trace.clientToServerMs,
      },
    });
  }
}
