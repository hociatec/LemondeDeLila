import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

export type WsTicketScope = 'api' | 'presence' | 'notify' | 'room' | 'game';

export type WsTicketPayload = {
  sub: string; // userId
  scope: WsTicketScope;
  jti: string;
};

@Injectable()
export class WsTicketService {
  constructor(private readonly config: ConfigService) {}

  issue(userId: number, scope: WsTicketScope): {
    ticket: string;
    expiresInSeconds: number;
    scope: WsTicketScope;
  } {
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new UnauthorizedException('Utilisateur invalide');
    }

    const expiresInSeconds = this.getTtlSeconds();
    const secret = this.getSecret();

    const payload: WsTicketPayload = {
      sub: String(userId),
      scope,
      jti: randomUUID(),
    };

    const ticket = jwt.sign(payload, secret, {
      expiresIn: expiresInSeconds,
      audience: 'lila-ws',
      issuer: 'lila-backend',
    });

    return { ticket, expiresInSeconds, scope };
  }

  verify(ticket: string, scope: WsTicketScope): WsTicketPayload {
    const secret = this.getSecret();
    try {
      const decoded = jwt.verify(ticket, secret, {
        audience: 'lila-ws',
        issuer: 'lila-backend',
      }) as WsTicketPayload;

      if (!decoded || typeof decoded !== 'object') {
        throw new UnauthorizedException('Ticket invalide');
      }

      if (decoded.scope !== scope) {
        throw new UnauthorizedException('Ticket invalide (scope)');
      }

      const userId = parseInt(decoded.sub, 10);
      if (!Number.isFinite(userId) || userId <= 0) {
        throw new UnauthorizedException('Ticket invalide (sub)');
      }

      return decoded;
    } catch {
      throw new UnauthorizedException('Ticket invalide');
    }
  }

  private getSecret(): string {
    const secret =
      this.config.get<string>('WS_TICKET_SECRET') ||
      this.config.get<string>('JWT_SECRET') ||
      process.env.WS_TICKET_SECRET ||
      process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedException('Configuration WS manquante');
    }
    return secret;
  }

  private getTtlSeconds(): number {
    const raw =
      this.config.get<number>('WS_TICKET_TTL_SECONDS') ??
      (process.env.WS_TICKET_TTL_SECONDS
        ? parseInt(process.env.WS_TICKET_TTL_SECONDS, 10)
        : null);

    const ttl = typeof raw === 'number' && Number.isFinite(raw) ? raw : 60;
    // Keep it short-lived.
    return Math.max(10, Math.min(300, ttl));
  }
}

