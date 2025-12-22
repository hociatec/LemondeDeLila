import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { WebSocket } from 'ws';
import { timingSafeEqual } from 'crypto';

/**
 * Vérifie la présence d'un secret partagé pour les connexions WS sensibles.
 * Le client envoie le secret dans le paramètre `signature` (ou certains headers)
 * et le backend le compare en constant-time pour limiter les fuites d'information.
 */
@Injectable()
export class WsSignatureService {
  private readonly secret: string | null;
  private readonly logger = new Logger(WsSignatureService.name);

  constructor(private readonly config: ConfigService) {
    this.secret = this.normalize(
      config.get<string>('WS_SHARED_SECRET') ||
        config.get<string>('REALTIME_WS_SECRET') ||
        process.env.WS_SHARED_SECRET ||
        process.env.REALTIME_WS_SECRET,
    );
  }

  isEnabled(): boolean {
    return Boolean(this.secret);
  }

  validate(client: WebSocket, args: any[]): boolean {
    if (!this.secret) {
      return true;
    }
    const provided = this.extractSignature(client, args);
    if (!provided) {
      this.logger.warn('Connexion WS refusée: signature absente.');
      return false;
    }
    return this.compare(this.secret, provided);
  }

  private extractSignature(client: WebSocket, args: any[]): string | null {
    const request: any =
      (args && args[0]) || (client as any).upgradeReq || (client as any).req;
    const urlCandidate = (client as any).url || request?.url || '';
    if (typeof urlCandidate === 'string' && urlCandidate.trim()) {
      try {
        const url = new URL(urlCandidate, 'ws://localhost');
        const fromQuery = url.searchParams.get('signature');
        if (fromQuery && fromQuery.trim()) {
          return fromQuery.trim();
        }
      } catch {
        /* ignore invalid URL */
      }
    }
    const headers = (client as any).handshakeHeaders || request?.headers;
    const headerSignature = this.extractHeaderSignature(headers);
    if (!headerSignature) {
      this.logger.warn('Connexion WS refusée: signature absente (query/header).');
    }
    return headerSignature;
  }

  private extractHeaderSignature(headers: any): string | null {
    if (!headers) {
      return null;
    }
    const candidates = [
      'x-lila-signature',
      'x-lila-ws-signature',
      'x-ws-signature',
      'x-signature',
    ];
    for (const key of candidates) {
      const value = headers[key] || headers[key.toLowerCase()] || null;
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return null;
  }

  private compare(expected: string, provided: string): boolean {
    const a = Buffer.from(expected, 'utf-8');
    const b = Buffer.from(provided, 'utf-8');
    if (a.length !== b.length) {
      return false;
    }
    try {
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  private normalize(value?: string | null): string | null {
    if (!value) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
