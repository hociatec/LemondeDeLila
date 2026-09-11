export type WsTicketScope = 'api' | 'presence' | 'notify' | 'room' | 'game';

export type WsTicketPayload = {
  sub: string;
  scope: WsTicketScope;
  jti: string;
};

export type WsTicketValidationResult =
  | { ok: true; reason: 'not_required' | 'ok'; ticketPresent: boolean }
  | {
      ok: false;
      reason: 'missing_ticket' | 'invalid_ticket';
      ticketPresent: boolean;
    };
/** Explicitly named data contract at the application boundary. */
