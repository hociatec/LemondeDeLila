import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebSocket } from 'ws';
import { getErrorDetails } from '../../../../../shared/utils/public-api';
import {
  stringifyExternalJson,
  type PresentedErrorPayload,
} from '../../../../serialization/public-api';
import { decodeWsEnvelope } from '../../../../ws/public-api';
import type { RealtimeIncomingMessage } from './realtime-api.types';
import type { RealtimeResponseFrame } from './realtime-request-replay.service';

const MAX_REALTIME_OUTBOUND_BYTES = 1 * 1024 * 1024;

/** Owns wire parsing, response framing and socket write failure handling. */
@Injectable()
export class RealtimeApiTransportService {
  private readonly logger = new Logger(RealtimeApiTransportService.name);
  constructor(private readonly config: ConfigService) {}
  decode(raw: unknown): RealtimeIncomingMessage | null {
    const configured = Number(
      this.config.get<number>('WS_MAX_PAYLOAD_BYTES', 65_536),
    );
    const maxBytes =
      Number.isSafeInteger(configured) &&
      configured >= 1 &&
      configured <= 1_048_576
        ? configured
        : 65_536;
    return decodeWsEnvelope(raw, maxBytes);
  }

  send(client: WebSocket, payload: unknown) {
    if (client.readyState !== WebSocket.OPEN) return;
    try {
      const serialized = stringifyExternalJson(payload);
      if (Buffer.byteLength(serialized, 'utf8') > MAX_REALTIME_OUTBOUND_BYTES) {
        client.close(1009, 'Message too large');
        return;
      }
      client.send(serialized);
    } catch (err) {
      this.logger.warn('Echec envoi WS', getErrorDetails(err));
      try {
        client.close();
      } catch {
        /* ignore */
      }
    }
  }

  error(
    client: WebSocket,
    error: string | PresentedErrorPayload,
    context?: string,
    requestId?: string,
  ) {
    this.send(client, this.errorFrame(error, context, requestId));
  }

  errorFrame(
    error: string | PresentedErrorPayload,
    context?: string,
    requestId?: string,
  ): RealtimeResponseFrame {
    return {
      type: 'error',
      requestId,
      context,
      payload: typeof error === 'string' ? { message: error } : error,
    };
  }
}
