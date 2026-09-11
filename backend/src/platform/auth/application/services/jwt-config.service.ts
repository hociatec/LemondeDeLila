import { UnauthorizedException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import type { AuthRuntimeConfig } from '../ports/auth-runtime-config.port';

function readKeyFromPath(path: string): string {
  if (typeof path !== 'string' || !path.trim() || path.length > 4096) {
    throw new UnauthorizedException('Configuration JWT manquante');
  }
  try {
    const key = readFileSync(path, 'utf8');
    if (key.length > 128 * 1024) {
      throw new UnauthorizedException('Configuration JWT invalide');
    }
    return key;
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
  if (typeof pem !== 'string' || !pem.trim() || pem.length > 128 * 1024) {
    throw new UnauthorizedException('Configuration JWT manquante');
  }
  return pem;
}

export function requireJwtVerifyKey(config: AuthRuntimeConfig): string {
  const pem =
    config.jwtPublicKeyPem ||
    (config.jwtPublicKeyPath ? readKeyFromPath(config.jwtPublicKeyPath) : null);
  if (typeof pem !== 'string' || !pem.trim() || pem.length > 128 * 1024) {
    throw new UnauthorizedException('Configuration JWT manquante');
  }
  return pem;
}
