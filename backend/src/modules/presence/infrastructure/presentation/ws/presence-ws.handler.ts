import { Injectable } from '@nestjs/common';
import { WebSocket } from 'ws';
import { WsRequestRateLimitService } from '../../../../../platform/ws/public-api';
import { PresenceService } from '../../../application/services/presence.service';

@Injectable()
export class PresenceWsHandler {
  constructor(
    private readonly presence: PresenceService,
    private readonly rateLimit: WsRequestRateLimitService,
  ) {}

  async handleIncoming(client: WebSocket, raw: unknown): Promise<void> {
    const session = this.presence.findClient(client);
    if (!session) {
      client.close();
      return;
    }

    if (!(await this.rateLimit.allow(session.user.id))) {
      client.close(1013, 'rate limit');
      return;
    }
    await this.presence.handleClientPayload(session, raw);
  }
}
