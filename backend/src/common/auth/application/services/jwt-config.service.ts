import { UnauthorizedException } from '@nestjs/common';
import type { Algorithm } from 'jsonwebtoken';
import type { AuthRuntimeConfig } from '../ports/auth-runtime-config.port';

export type JwtAlgorithm = 'HS256' | 'RS256';

function normalizeAlgorithm(
  value: string | undefined | null,
): JwtAlgorithm | null {
  const normalized = (value || '').trim().toUpperCase();
  if (normalized === 'HS256' || normalized === 'RS256') {
    return normalized;
  }
  return null;
}

function readKeyFromPath(path: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    return fs.readFileSync(path, 'utf8');
  } catch {
    throw new UnauthorizedException('Configuration JWT manquante');
  }
}

export function getJwtAlgorithm(config: AuthRuntimeConfig): JwtAlgorithm {
  const explicit = normalizeAlgorithm(config.jwtAlgorithm);
  if (explicit) {
    return explicit;
  }

  const hasRsa =
    !!config.jwtPrivateKeyPem ||
    !!config.jwtPrivateKeyPath ||
    !!config.jwtPublicKeyPem ||
    !!config.jwtPublicKeyPath;
  return hasRsa ? 'RS256' : 'HS256';
}

export function requireJwtSigningKey(config: AuthRuntimeConfig): string {
  const algorithm = getJwtAlgorithm(config);
  if (algorithm === 'HS256') {
    const secret = config.jwtSecret;
    if (!secret || !secret.trim()) {
      throw new UnauthorizedException('Configuration JWT manquante');
    }
    return secret;
  }

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
  const algorithm = getJwtAlgorithm(config);
  if (algorithm === 'HS256') {
    const secret = config.jwtSecret;
    if (!secret || !secret.trim()) {
      throw new UnauthorizedException('Configuration JWT manquante');
    }
    return secret;
  }

  const pem =
    config.jwtPublicKeyPem ||
    (config.jwtPublicKeyPath
      ? readKeyFromPath(config.jwtPublicKeyPath)
      : null);
  if (!pem || !pem.trim()) {
    throw new UnauthorizedException('Configuration JWT manquante');
  }
  return pem;
}

export function getJwtVerifyAlgorithms(config: AuthRuntimeConfig): Algorithm[] {
  return [getJwtAlgorithm(config)] as Algorithm[];
}
