import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type SignOptions,
  type VerifyOptions,
  sign as jwtSign,
  verify as jwtVerify,
} from 'jsonwebtoken';
import { randomBytes, randomUUID } from 'crypto';

export type WsTicketScope = 'api' | 'presence' | 'notify' | 'room' | 'game';

export type WsTicketPayload = {
  sub: string; // userId
  scope: WsTicketScope;
  jti: string;
};

@Injectable()
export class WsTicketService {
  private readonly logger = new Logger(WsTicketService.name);
  private ephemeralSecret: string | null = null;
  private warnedMissingSecret = false;

  constructor(private readonly config: ConfigService) {}

  issue(
    userId: number,
    scope: WsTicketScope,
  ): {
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

    const ticket = jwtSign(payload, secret, {
      expiresIn: expiresInSeconds,
      audience: 'lila-ws',
      issuer: 'lila-backend',
    } as SignOptions);

    return { ticket, expiresInSeconds, scope };
  }

  verify(ticket: string, scope: WsTicketScope): WsTicketPayload {
    const secret = this.getSecret();
    try {
      const decoded = jwtVerify(ticket, secret, {
        audience: 'lila-ws',
        issuer: 'lila-backend',
      } as VerifyOptions);

      if (!decoded || typeof decoded !== 'object') {
        throw new UnauthorizedException('Ticket invalide');
      }
      const typed = decoded as Partial<WsTicketPayload>;

      if (typed.scope !== scope) {
        throw new UnauthorizedException('Ticket invalide (scope)');
      }

      if (typeof typed.sub !== 'string') {
        throw new UnauthorizedException('Ticket invalide (sub)');
      }
      const userId = parseInt(typed.sub, 10);
      if (!Number.isFinite(userId) || userId <= 0) {
        throw new UnauthorizedException('Ticket invalide (sub)');
      }

      if (typeof typed.jti !== 'string' || !typed.jti.trim()) {
        throw new UnauthorizedException('Ticket invalide (jti)');
      }

      return typed as WsTicketPayload;
    } catch {
      throw new UnauthorizedException('Ticket invalide');
    }
  }

  private getSecret(): string {
    const secret = this.config.get<string>('WS_TICKET_SECRET');
    if (!secret) {
      const nodeEnv = String(
        this.config.get<string>('NODE_ENV') || process.env.NODE_ENV || '',
      )
        .trim()
        .toLowerCase();
      if (nodeEnv === 'production') {
        throw new UnauthorizedException('Configuration WS manquante');
      }

      if (!this.ephemeralSecret) {
        // Dev-only fallback to keep local setups working even when WS_TICKET_SECRET is missing.
        this.ephemeralSecret = randomBytes(32).toString('base64url');
      }
      if (!this.warnedMissingSecret) {
        this.warnedMissingSecret = true;
        this.logger.warn(
          'WS_TICKET_SECRET manquant: utilisation dâ€™un secret Ã©phÃ©mÃ¨re (dev uniquement).',
        );
      }
      return this.ephemeralSecret;
    }
    return secret;
  }

  private getTtlSeconds(): number {
    const raw = this.config.get<number>('WS_TICKET_TTL_SECONDS');
    const ttl = typeof raw === 'number' && Number.isFinite(raw) ? raw : 60;
    // Keep it short-lived.
    return Math.max(10, Math.min(300, ttl));
  }
}
