import { Injectable } from '@nestjs/common';
import type { WebSocket } from 'ws';
import { WsTicketScope, WsTicketService } from './ws-ticket.service';

export type WsTicketValidationResult =
  | { ok: true; reason: 'not_required' | 'ok'; ticketPresent: boolean }
  | { ok: false; reason: 'missing_ticket' | 'invalid_ticket'; ticketPresent: boolean };

@Injectable()
export class WsTicketAuthService {
  constructor(private readonly tickets: WsTicketService) {}

  /**
   * Validates a short-lived WS ticket from query or headers.
   * Returns true if valid; false otherwise (callers typically close the socket).
   */
  validate(client: WebSocket, args: any[], scope: WsTicketScope): boolean {
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
    client: WebSocket,
    args: any[],
    scope: WsTicketScope,
    hasUserToken: boolean,
  ): boolean {
    if (!hasUserToken) {
      return true;
    }
    return this.validate(client, args, scope);
  }

  validateIfTokenPresentDetailed(
    client: WebSocket,
    args: any[],
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

  private extractTicket(client: WebSocket, args: any[]): string | null {
    const request: any =
      (args && args[0]) || (client as any).upgradeReq || (client as any).req;
    const urlCandidate = (client as any).url || request?.url || '';

    if (typeof urlCandidate === 'string' && urlCandidate.trim()) {
      try {
        const url = new URL(urlCandidate, 'ws://localhost');
        const fromQuery =
          url.searchParams.get('ticket') || url.searchParams.get('wsTicket');
        if (fromQuery && fromQuery.trim()) {
          return fromQuery.trim();
        }
      } catch {
        /* ignore */
      }
    }

    const headers = (client as any).handshakeHeaders || request?.headers;
    if (!headers) return null;
    const value =
      headers['x-lila-ws-ticket'] ||
      headers['X-Lila-Ws-Ticket'] ||
      headers['x-ws-ticket'] ||
      headers['x-lila-ticket'] ||
      headers['x-lila-ws-ticket'.toLowerCase()] ||
      null;
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    return null;
  }
}

