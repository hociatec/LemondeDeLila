export type AuthRuntimeConfig = {
  jwtPrivateKeyPem: string | null;
  jwtPrivateKeyPath: string | null;
  jwtPublicKeyPem: string | null;
  jwtPublicKeyPath: string | null;
  jwtIssuer: string;
  jwtAudience: string | null;
  jwtClockToleranceSeconds: number;
};

function trimOrNull(value: string | undefined): string | null {
  const trimmed = String(value ?? '').trim();
  return trimmed || null;
}

export function readAuthRuntimeConfigFromEnv(): AuthRuntimeConfig {
  const clockToleranceRaw = Number(
    readEnvironment('JWT_CLOCK_TOLERANCE_SECONDS'),
  );

  return {
    jwtPrivateKeyPem: trimOrNull(readEnvironment('JWT_PRIVATE_KEY_PEM')),
    jwtPrivateKeyPath: trimOrNull(readEnvironment('JWT_PRIVATE_KEY_PATH')),
    jwtPublicKeyPem: trimOrNull(readEnvironment('JWT_PUBLIC_KEY_PEM')),
    jwtPublicKeyPath: trimOrNull(readEnvironment('JWT_PUBLIC_KEY_PATH')),
    jwtIssuer: trimOrNull(readEnvironment('JWT_ISSUER')) ?? 'le-monde-de-lila',
    jwtAudience: trimOrNull(readEnvironment('JWT_AUDIENCE')),
    jwtClockToleranceSeconds:
      Number.isFinite(clockToleranceRaw) && clockToleranceRaw >= 0
        ? clockToleranceRaw
        : 10,
  };
}
import { readEnvironment } from '../../../config/public-api';
