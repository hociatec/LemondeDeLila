import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Inject } from '@nestjs/common';

import type { VerifyOptions } from 'jsonwebtoken';
import { verify as jwtVerify } from 'jsonwebtoken';

import type { IncomingHttpHeaders, IncomingMessage } from 'http';

import type { WsAuthPayload } from '../../../../shared/interfaces/public-api';
import {
  WS_RUNTIME_CONFIG,
  type WsRuntimeConfig,
} from '../ports/ws-runtime-config.port';
import { requireJwtVerifyKey } from '../../../auth/public-api';

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
    return (
      this.extractBearer(client.handshakeHeaders) ||
      this.extractBearer(request?.headers)
    );
  }

  extractClientVersion(client: WsClientLike, args: unknown[]): string | null {
    const firstArg = args[0];
    const request = this.resolveRequest(client, firstArg);
    const headers = client.handshakeHeaders ?? request?.headers;
    return this.readHeader(headers, 'x-lila-client-version');
  }

  extractClientProduct(client: WsClientLike, args: unknown[]): string | null {
    const firstArg = args[0];
    const request = this.resolveRequest(client, firstArg);
    const headers = client.handshakeHeaders ?? request?.headers;
    return (
      this.readHeader(headers, 'x-lila-client-product')?.toLowerCase() ?? null
    );
  }

  verify(token: string): WsAuthPayload {
    const key = requireJwtVerifyKey(this.config);
    const issuer = this.config.jwtIssuer;
    const audience = this.config.jwtAudience ?? undefined;
    const clockTolerance = this.config.jwtClockToleranceSeconds;
    try {
      const verifyOptions: JwtVerifyOptions = {
        algorithms: ['RS256'],
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
      const username = WsJwtAuthService.getTrimmedString(record, 'username');
      const id = WsJwtAuthService.getNumber(record, 'id');
      const exp = WsJwtAuthService.getNumber(record, 'exp');
      const iat = WsJwtAuthService.getNumber(record, 'iat');
      if (!sub || !username || id == null || exp == null || iat == null) {
        throw new UnauthorizedException('Token invalide');
      }
      return WsJwtAuthService.buildVerifiedPayload(
        record,
        id,
        username,
        sub,
        exp,
        iat,
      );
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
    const authHeader = this.readHeader(headers, 'authorization');
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
    username: string,
    sub: string,
    exp: number,
    iat: number,
  ): VerifiedWsPayload {
    return {
      id,
      username,
      email: WsJwtAuthService.getOptionalString(record, 'email'),
      roles: WsJwtAuthService.getStringArray(record, 'roles'),
      sub,
      exp,
      iat,
    };
  }
}
