import { Inject, Injectable, Logger } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import type { IncomingHttpHeaders, IncomingMessage } from 'http';
import {
  WS_RUNTIME_CONFIG,
  type WsRuntimeConfig,
} from '../ports/ws-runtime-config.port';

export type WsRequestLike = IncomingMessage & {
  url?: string;
  headers?: IncomingHttpHeaders;
};

export type WsClientLike = {
  upgradeReq?: WsRequestLike;
  req?: WsRequestLike;
  handshakeHeaders?: IncomingHttpHeaders;
  url?: string;
};

/**
 * Verifie la presence d'un secret partage pour les connexions WS sensibles.
 * Le client envoie le secret dans le parametre `signature` (ou certains headers)
 * et le backend le compare en constant-time pour limiter les fuites d'information.
 */
@Injectable()
export class WsSignatureService {
  private readonly secret: string | null;
  private readonly logger = new Logger(WsSignatureService.name);

  constructor(@Inject(WS_RUNTIME_CONFIG) config: WsRuntimeConfig) {
    this.secret = this.normalize(config.sharedSecret);
  }

  isEnabled(): boolean {
    return Boolean(this.secret);
  }

  validate(client: WsClientLike, args: unknown[]): boolean {
    if (!this.secret) {
      return true;
    }
    const provided = this.extractSignature(client, args);
    if (!provided) {
      this.logger.warn('Connexion WS refusee: signature absente.');
      return false;
    }
    return this.compare(this.secret, provided);
  }

  private extractSignature(
    client: WsClientLike,
    args: unknown[],
  ): string | null {
    const firstArg = args[0];
    const request = this.resolveRequest(client, firstArg);
    const urlCandidate = this.pickUrl(client, request);

    if (urlCandidate) {
      const trimmedUrl = urlCandidate.trim();
      if (trimmedUrl) {
        try {
          const url = new URL(trimmedUrl, 'ws://localhost');
          const fromQuery = url.searchParams.get('signature');
          if (fromQuery && fromQuery.trim()) {
            return fromQuery.trim();
          }
        } catch {
          /* ignore invalid URL */
        }
      }
    }

    const headers = client.handshakeHeaders ?? request?.headers;
    const headerSignature = this.extractHeaderSignature(headers);
    if (!headerSignature) {
      this.logger.warn(
        'Connexion WS refusee: signature absente (query/header).',
      );
    }
    return headerSignature;
  }

  private extractHeaderSignature(
    headers: IncomingHttpHeaders | undefined,
  ): string | null {
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
