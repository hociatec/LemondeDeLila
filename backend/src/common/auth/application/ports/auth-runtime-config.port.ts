export type AuthRuntimeConfig = {
  jwtAlgorithm: string | null;
  jwtSecret: string | null;
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
  const clockToleranceRaw = Number(process.env.JWT_CLOCK_TOLERANCE_SECONDS);

  return {
    jwtAlgorithm: trimOrNull(process.env.JWT_ALGORITHM),
    jwtSecret: trimOrNull(process.env.JWT_SECRET),
    jwtPrivateKeyPem: trimOrNull(process.env.JWT_PRIVATE_KEY_PEM),
    jwtPrivateKeyPath: trimOrNull(process.env.JWT_PRIVATE_KEY_PATH),
    jwtPublicKeyPem: trimOrNull(process.env.JWT_PUBLIC_KEY_PEM),
    jwtPublicKeyPath: trimOrNull(process.env.JWT_PUBLIC_KEY_PATH),
    jwtIssuer: trimOrNull(process.env.JWT_ISSUER) ?? 'le-monde-de-lila',
    jwtAudience: trimOrNull(process.env.JWT_AUDIENCE),
    jwtClockToleranceSeconds:
      Number.isFinite(clockToleranceRaw) && clockToleranceRaw >= 0
        ? clockToleranceRaw
        : 10,
  };
}
