import { UnauthorizedException } from '@nestjs/common';
import type { AuthRuntimeConfig } from '../ports/auth-runtime-config.port';

function readKeyFromPath(path: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    return fs.readFileSync(path, 'utf8');
  } catch {
    throw new UnauthorizedException('Configuration JWT manquante');
  }
}

export function requireJwtSigningKey(config: AuthRuntimeConfig): string {
  const pem =
    config.jwtPrivateKeyPem ||
    (config.jwtPrivateKeyPath
      ? readKeyFromPath(config.jwtPrivateKeyPath)
      : null);
  if (!pem || !pem.trim()) {
    throw new UnauthorizedException('Configuration JWT manquante');
  }
  return pem;
}

export function requireJwtVerifyKey(config: AuthRuntimeConfig): string {
  const pem =
    config.jwtPublicKeyPem ||
    (config.jwtPublicKeyPath ? readKeyFromPath(config.jwtPublicKeyPath) : null);
  if (!pem || !pem.trim()) {
    throw new UnauthorizedException('Configuration JWT manquante');
  }
  return pem;
}
