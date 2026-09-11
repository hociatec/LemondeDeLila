import { Injectable } from '@nestjs/common';
import { WebSocket } from 'ws';
import type { RoomPayload } from '../../../application/models/room-payload.model';
import { RoomClientPolicyService } from '../../../application/services/membership/room-client-policy.service';
import { RoomGatewayStatePresenter } from './room-gateway-state.presenter';
import type { ClientMeta } from './room-gateway.types';

type RoomBroadcastSocket = {
  readonly readyState: number;
  send(message: string): void;
  close(): void;
};

type RoomBroadcastContext = {
  clients: ReadonlyMap<RoomBroadcastSocket, Pick<ClientMeta, 'userId'>>;
  rooms: Map<number, Set<RoomBroadcastSocket>>;
  silentRooms: Map<number, Set<RoomBroadcastSocket>>;
};

const MAX_WS_OUTBOUND_BYTES = 1_048_576;

/** Send one serialized payload per permission group and remove unusable sockets. */
@Injectable()
export class RoomPayloadBroadcaster {
  constructor(
    private readonly clientPolicy: RoomClientPolicyService,
    private readonly presenter: RoomGatewayStatePresenter,
  ) {}
  async broadcast(
    ctx: RoomBroadcastContext,
    roomId: number,
    payload: RoomPayload,
  ): Promise<void> {
    const targets = ctx.rooms.get(roomId);
    const silentTargets = ctx.silentRooms.get(roomId);

    const serializedByActions = new Map<string, string>();
    const messageFor = (meta: Pick<ClientMeta, 'userId'>): string => {
      const actions = this.clientPolicy.listAllowedActions(
        payload,
        meta.userId,
      );
      const cacheKey = JSON.stringify(actions);
      const cached = serializedByActions.get(cacheKey);
      if (cached) return cached;
      const message = JSON.stringify(
        this.presenter.presentRoomUpdated(roomId, {
          ...payload,
          room: { ...payload.room, allowedActions: actions },
        }),
      );
      if (Buffer.byteLength(message, 'utf8') > MAX_WS_OUTBOUND_BYTES) {
        throw new Error('Room payload too large');
      }
      serializedByActions.set(cacheKey, message);
      return message;
    };

    const sendToSet = (set?: Set<RoomBroadcastSocket>) => {
      if (!set) return;
      for (const socket of Array.from(set)) {
        const meta = ctx.clients.get(socket);
        if (!meta || socket.readyState !== WebSocket.OPEN) {
          set.delete(socket);
          continue;
        }
        try {
          socket.send(messageFor(meta));
        } catch {
          set.delete(socket);
          try {
            socket.close();
          } catch {
            // ignore
          }
        }
      }
      if (set.size === 0) {
        if (set === targets) ctx.rooms.delete(roomId);
        if (set === silentTargets) ctx.silentRooms.delete(roomId);
      }
    };

    sendToSet(targets);
    sendToSet(silentTargets);
  }
}
