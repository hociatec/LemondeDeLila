import { Injectable } from '@nestjs/common';
import {
  WsTicketScope,
  WsTicketValidationResult,
} from '../models/ws-ticket.model';
import { WsTicketService } from './ws-ticket.service';
import type { IncomingHttpHeaders, IncomingMessage } from 'http';

type WsRequestLike = IncomingMessage & {
  url?: string;
  headers?: IncomingHttpHeaders;
};

type WsClientLike = {
  upgradeReq?: WsRequestLike;
  req?: WsRequestLike;
  handshakeHeaders?: IncomingHttpHeaders;
  url?: string;
};

@Injectable()
export class WsTicketAuthService {
  constructor(private readonly tickets: WsTicketService) {}

  /**
   * Validates a short-lived WS ticket from query or headers.
   * Returns true if valid; false otherwise (callers typically close the socket).
   */
  validate(
    client: WsClientLike,
    args: unknown[],
    scope: WsTicketScope,
  ): boolean {
    const ticket = this.extractTicket(client, args);
    if (!ticket) {
      return false;
    }
    try {
      this.tickets.verify(ticket, scope);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Some WS endpoints support unauthenticated use (ex: login).
   * In that case, only enforce a ticket when a user token is present.
   */
  validateIfTokenPresent(
    client: WsClientLike,
    args: unknown[],
    scope: WsTicketScope,
    hasUserToken: boolean,
  ): boolean {
    if (!hasUserToken) {
      return true;
    }
    return this.validate(client, args, scope);
  }

  validateIfTokenPresentDetailed(
    client: WsClientLike,
    args: unknown[],
    scope: WsTicketScope,
    hasUserToken: boolean,
  ): WsTicketValidationResult {
    if (!hasUserToken) {
      return { ok: true, reason: 'not_required', ticketPresent: false };
    }

    const ticket = this.extractTicket(client, args);
    if (!ticket) {
      return { ok: false, reason: 'missing_ticket', ticketPresent: false };
    }

    try {
      this.tickets.verify(ticket, scope);
      return { ok: true, reason: 'ok', ticketPresent: true };
    } catch {
      return { ok: false, reason: 'invalid_ticket', ticketPresent: true };
    }
  }

  private extractTicket(client: WsClientLike, args: unknown[]): string | null {
    const firstArg = args[0];
    const request = this.resolveRequest(client, firstArg);
    const urlCandidate = this.pickUrl(client, request);

    if (urlCandidate) {
      const trimmedUrl = urlCandidate.trim();
      if (trimmedUrl) {
        try {
          const url = new URL(trimmedUrl, 'ws://localhost');
          const fromQuery =
            url.searchParams.get('ticket') ?? url.searchParams.get('wsTicket');
          if (fromQuery && fromQuery.trim()) {
            return fromQuery.trim();
          }
        } catch {
          /* ignore */
        }
      }
    }

    const headers = client.handshakeHeaders ?? request?.headers;
    return this.readTicketHeader(headers);
  }

  private readTicketHeader(
    headers: IncomingHttpHeaders | undefined,
  ): string | null {
    if (!headers) {
      return null;
    }
    const candidates = ['x-lila-ws-ticket', 'x-lila-ticket', 'x-ws-ticket'];
    for (const key of candidates) {
      const value = this.normalizeHeaderValue(headers[key]);
      if (value) {
        return value;
      }
    }
    return null;
  }

  private resolveRequest(
    client: WsClientLike,
    firstArg: unknown,
  ): WsRequestLike | null {
    if (firstArg && typeof firstArg === 'object' && firstArg !== null) {
      return firstArg as WsRequestLike;
    }
    return client.upgradeReq ?? client.req ?? null;
  }

  private pickUrl(
    client: WsClientLike,
    request: WsRequestLike | null,
  ): string | null {
    const raw =
      (typeof client.url === 'string' ? client.url : '') ||
      (typeof request?.url === 'string' ? request.url : '');
    const trimmed = raw.trim();
    return trimmed || null;
  }

  private normalizeHeaderValue(
    raw: string | string[] | undefined,
  ): string | null {
    if (!raw) return null;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed || null;
  }
}
