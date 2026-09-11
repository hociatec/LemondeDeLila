import { ConfigService } from '@nestjs/config';
import type { WsRuntimeConfig } from '../../application/ports/ws-runtime-config.port';

export function createWsRuntimeConfig(config: ConfigService): WsRuntimeConfig {
  const nodeEnv = String(config.get<string>('NODE_ENV') ?? '')
    .trim()
    .toLowerCase();
  const jwtIssuer = String(
    config.get<string>('JWT_ISSUER') ?? 'le-monde-de-lila',
  ).trim();
  const jwtAudience = String(config.get<string>('JWT_AUDIENCE') ?? '').trim();
  const clockToleranceRaw = Number(
    config.get<number>('JWT_CLOCK_TOLERANCE_SECONDS'),
  );
  const wsTicketTtlRaw = Number(config.get<number>('WS_TICKET_TTL_SECONDS'));
  const wsTicketSecret = String(
    config.get<string>('WS_TICKET_SECRET') ?? '',
  ).trim();
  const maxBufferedBytes = Number(
    config.get<number>('WS_MAX_BUFFERED_BYTES', 1_048_576),
  );
  const wsRateLimitWindowMs = Number(
    config.get<number>('WS_RATE_LIMIT_WINDOW_MS', 10_000),
  );
  const wsRateLimitCount = Number(
    config.get<number>('WS_RATE_LIMIT_COUNT', 60),
  );

  return {
    nodeEnv,
    wsTicketSecret: wsTicketSecret || null,
    wsTicketTtlSeconds:
      Number.isSafeInteger(wsTicketTtlRaw) &&
      wsTicketTtlRaw >= 1 &&
      wsTicketTtlRaw <= 3_600
        ? wsTicketTtlRaw
        : 60,
    jwtIssuer: jwtIssuer || 'le-monde-de-lila',
    jwtAudience: jwtAudience || null,
    jwtClockToleranceSeconds:
      Number.isSafeInteger(clockToleranceRaw) &&
      clockToleranceRaw >= 0 &&
      clockToleranceRaw <= 300
        ? clockToleranceRaw
        : 10,
    jwtPrivateKeyPem:
      String(config.get<string>('JWT_PRIVATE_KEY_PEM') ?? '').trim() || null,
    jwtPrivateKeyPath:
      String(config.get<string>('JWT_PRIVATE_KEY_PATH') ?? '').trim() || null,
    jwtPublicKeyPem:
      String(config.get<string>('JWT_PUBLIC_KEY_PEM') ?? '').trim() || null,
    jwtPublicKeyPath:
      String(config.get<string>('JWT_PUBLIC_KEY_PATH') ?? '').trim() || null,
    maxBufferedBytes:
      Number.isSafeInteger(maxBufferedBytes) &&
      maxBufferedBytes >= 65_536 &&
      maxBufferedBytes <= 64 * 1024 * 1024
        ? maxBufferedBytes
        : 1_048_576,
    wsRateLimitWindowMs:
      Number.isSafeInteger(wsRateLimitWindowMs) &&
      wsRateLimitWindowMs >= 1_000 &&
      wsRateLimitWindowMs <= 3_600_000
        ? wsRateLimitWindowMs
        : 10_000,
    wsRateLimitCount:
      Number.isSafeInteger(wsRateLimitCount) &&
      wsRateLimitCount >= 1 &&
      wsRateLimitCount <= 10_000
        ? wsRateLimitCount
        : 60,
  };
}
