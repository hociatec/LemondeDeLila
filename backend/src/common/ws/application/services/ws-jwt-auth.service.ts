import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Inject } from '@nestjs/common';

import type { VerifyOptions } from 'jsonwebtoken';
import { verify as jwtVerify } from 'jsonwebtoken';

import type { IncomingHttpHeaders, IncomingMessage } from 'http';

import type { WsAuthPayload } from '../../../interfaces/public-api';
import {
  WS_RUNTIME_CONFIG,
  type WsRuntimeConfig,
} from '../ports/ws-runtime-config.port';
import {
  getJwtVerifyAlgorithms,
  requireJwtVerifyKey,
} from '../../../auth/public-api';

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

type JwtVerifyOptions = VerifyOptions;

type VerifiedWsPayload = WsAuthPayload & {
  sub: string;
  exp: number;
  iat: number;
};

@Injectable()
export class WsJwtAuthService {
  constructor(
    @Inject(WS_RUNTIME_CONFIG)
    private readonly config: WsRuntimeConfig,
  ) {}

  extractToken(client: WsClientLike, args: unknown[]): string | null {
    const firstArg = args[0];
    const request = this.resolveRequest(client, firstArg);
    const urlCandidate = this.pickUrl(client, request);
    const headerToken =
      this.extractBearer(client.handshakeHeaders) ||
      this.extractBearer(request?.headers);
    if (headerToken) {
      return headerToken;
    }
    return this.extractQueryToken(urlCandidate);
  }

  extractClientVersion(client: WsClientLike, args: unknown[]): string | null {
    const firstArg = args[0];
    const request = this.resolveRequest(client, firstArg);
    const urlCandidate = this.pickUrl(client, request);
    const headers = client.handshakeHeaders ?? request?.headers;
    const headerVersion =
      this.readHeader(headers, 'x-lila-client-version') ??
      this.readHeader(headers, 'X-Lila-Client-Version');
    if (headerVersion) {
      return headerVersion;
    }

    if (urlCandidate) {
      try {
        const url = new URL(urlCandidate, 'ws://localhost');
        const fromQuery =
          url.searchParams.get('v') ??
          url.searchParams.get('version') ??
          url.searchParams.get('clientVersion') ??
          '';
        const trimmed = fromQuery.trim();
        return trimmed || null;
      } catch {
        return null;
      }
    }

    return null;
  }

  verify(token: string): WsAuthPayload {
    const key = requireJwtVerifyKey(this.config);
    const issuer = this.config.jwtIssuer;
    const audience = this.config.jwtAudience ?? undefined;
    const clockTolerance = this.config.jwtClockToleranceSeconds;
    try {
      const verifyOptions: JwtVerifyOptions = {
        algorithms: getJwtVerifyAlgorithms(this.config),
        issuer,
        clockTolerance,
        ...(audience ? { audience } : {}),
      };
      const payload = jwtVerify(token, key, verifyOptions);
      if (!payload || typeof payload !== 'object') {
        throw new UnauthorizedException('Token invalide');
      }
      const record = WsJwtAuthService.toRecord(payload);
      const sub = WsJwtAuthService.getTrimmedString(record, 'sub');
      const id = WsJwtAuthService.getNumber(record, 'id');
      const exp = WsJwtAuthService.getNumber(record, 'exp');
      const iat = WsJwtAuthService.getNumber(record, 'iat');
      if (!sub || id == null || exp == null || iat == null) {
        throw new UnauthorizedException('Token invalide');
      }
      return WsJwtAuthService.buildVerifiedPayload(record, id, sub, exp, iat);
    } catch {
      throw new UnauthorizedException('Token invalide');
    }
  }

  tryVerify(token: string | null): WsAuthPayload | null {
    if (!token) return null;
    try {
      return this.verify(token);
    } catch {
      return null;
    }
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

  private readHeader(
    headers: IncomingHttpHeaders | undefined,
    key: string,
  ): string | null {
    if (!headers) return null;
    const normalizedKey = key.toLowerCase();
    const raw = headers[normalizedKey];
    return this.normalizeHeaderValue(raw);
  }

  private extractBearer(
    headers: IncomingHttpHeaders | undefined,
  ): string | null {
    if (!headers) return null;
    const authHeader =
      this.readHeader(headers, 'authorization') ??
      this.readHeader(headers, 'Authorization');
    if (!authHeader) return null;
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return parts[1];
    }
    return null;
  }

  private normalizeHeaderValue(
    raw: string | string[] | undefined,
  ): string | null {
    if (!raw) return null;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value !== 'string') return null;
    return value.trim() || null;
  }

  private extractQueryToken(urlCandidate: string | null): string | null {
    if (!urlCandidate) {
      return null;
    }
    try {
      const url = new URL(urlCandidate, 'ws://localhost');
      return url.searchParams.get('token');
    } catch {
      return null;
    }
  }

  private static toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private static getTrimmedString(
    record: Record<string, unknown>,
    key: string,
  ): string {
    const value = record[key];
    return typeof value === 'string' ? value.trim() : '';
  }

  private static getOptionalString(
    record: Record<string, unknown>,
    key: string,
  ): string | undefined {
    const value = record[key];
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : undefined;
  }

  private static getNumber(
    record: Record<string, unknown>,
    key: string,
  ): number | null {
    const value = record[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private static getStringArray(
    record: Record<string, unknown>,
    key: string,
  ): string[] | undefined {
    const value = record[key];
    if (!Array.isArray(value)) {
      return undefined;
    }
    const strings = value.filter(
      (item): item is string => typeof item === 'string',
    );
    return strings.length > 0 ? strings : undefined;
  }

  private static buildVerifiedPayload(
    record: Record<string, unknown>,
    id: number,
    sub: string,
    exp: number,
    iat: number,
  ): VerifiedWsPayload {
    return {
      id,
      username: WsJwtAuthService.getTrimmedString(record, 'username') || sub,
      email: WsJwtAuthService.getOptionalString(record, 'email'),
      roles: WsJwtAuthService.getStringArray(record, 'roles'),
      sub,
      exp,
      iat,
    };
  }
}
