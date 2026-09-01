import type { WebSocket } from 'ws';
import type { RoomPayload } from '../../../application/contracts/room-payload.model';
import {
  collectRoomAnnouncementMessages,
  type RoomSnapshot,
} from './room-announcement.helpers';
import { emitRoomAnnouncementDiff } from './room-announcement-diff.helpers';
import type { RoomFocusIntent } from './dto/room-focus-intent.ws.dto';
import type {
  RoomIntent,
  RoomStartWizardIntent,
} from './dto/room-intent.ws.dto';
import { RoomGatewayStatePresenter } from './room-gateway-state.presenter';

type AnnouncementContext = {
  lastRoomStatusByRoomId: Map<number, string>;
  safeSend(client: WebSocket, payload: unknown): void;
  broadcast(roomId: number, type: string, payload: unknown): Promise<void>;
};

/** Derives and presents accessibility announcements from room transitions. */
export class RoomGatewayAnnouncements {
  constructor(private readonly presenter: RoomGatewayStatePresenter) {}

  focusIntent(
    context: AnnouncementContext,
    roomId: number,
    payload: RoomPayload,
  ): RoomFocusIntent | null {
    const previous = normalized(context.lastRoomStatusByRoomId.get(roomId));
    const next = normalized(payload.room.status);
    return previous !== 'started' && next === 'started'
      ? {
          region: 'game',
          reason: 'room.started',
          priority: 'assertive',
          announce: false,
        }
      : null;
  }

  startWizardIntent(
    payload: RoomPayload,
    previousStatus: string,
    nextStatus: string,
  ): RoomStartWizardIntent | null {
    if (previousStatus.length > 0 || !nextStatus || nextStatus === 'started')
      return null;
    return {
      ownerId: payload.room.owner?.id ?? null,
      title: 'Configuration de la table',
      description: 'Le serveur vous invite à préparer la partie.',
      message: "Choisissez rapidement l'ambiance et la configuration.",
    };
  }

  sendFocus(
    context: AnnouncementContext,
    client: WebSocket,
    roomId: number,
    focus: RoomFocusIntent,
  ): void {
    context.safeSend(client, this.presenter.presentRoomFocus(roomId, focus));
    const intents = [this.presenter.presentFocusIntent(focus)];
    if (focus.announce !== false)
      intents.push(this.presenter.presentFocusAnnouncement(focus));
    for (const intent of intents) {
      context.safeSend(
        client,
        this.presenter.presentRoomIntent(roomId, intent),
      );
    }
  }

  async broadcastDiff(
    context: AnnouncementContext,
    roomId: number,
    previous: RoomSnapshot | undefined,
    next: RoomSnapshot,
  ): Promise<void> {
    const messages = collectRoomAnnouncementMessages(previous, next);
    if (!previous || messages.length > 0) {
      await Promise.all(
        messages.map((message) => this.broadcast(context, roomId, message)),
      );
      return;
    }
    await emitRoomAnnouncementDiff({
      roomId,
      previous,
      next,
      announce: (message) => this.broadcast(context, roomId, message),
    });
  }

  async broadcastIntent(
    context: AnnouncementContext,
    roomId: number,
    intent: RoomIntent,
  ): Promise<void> {
    await context.broadcast(roomId, 'room.intent', intent);
  }

  private async broadcast(
    context: AnnouncementContext,
    roomId: number,
    message: string,
    priority: 'polite' | 'assertive' = 'polite',
  ): Promise<void> {
    const value = message.trim();
    if (!value) return;
    await this.broadcastIntent(
      context,
      roomId,
      this.presenter.presentAnnouncement(value, priority),
    );
  }
}

function normalized(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase().trim() : '';
}
