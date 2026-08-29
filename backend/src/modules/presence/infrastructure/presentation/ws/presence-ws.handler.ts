import { Injectable } from '@nestjs/common';
import { WebSocket } from 'ws';
import { PresenceService } from '../../../application/services/presence.service';

@Injectable()
export class PresenceWsHandler {
  constructor(private readonly presence: PresenceService) {}

  async handleIncoming(client: WebSocket, raw: unknown): Promise<void> {
    const session = this.presence.findClient(client);
    if (!session) {
      client.close();
      return;
    }

    await this.presence.handleClientPayload(session, raw);
  }
}
