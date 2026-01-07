import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Algorithm } from 'jsonwebtoken';

export type JwtAlgorithm = 'HS256' | 'RS256';

function normalizeAlgorithm(
  value: string | undefined | null,
): JwtAlgorithm | null {
  const v = (value || '').trim().toUpperCase();
  if (v === 'HS256' || v === 'RS256') return v;
  return null;
}

export function getJwtAlgorithm(config: ConfigService): JwtAlgorithm {
  const explicit = normalizeAlgorithm(config.get<string>('JWT_ALGORITHM'));
  if (explicit) return explicit;

  // Default: if RSA keys are present, prefer RS256; otherwise HS256.
  const hasRsa =
    !!config.get<string>('JWT_PRIVATE_KEY_PEM') ||
    !!config.get<string>('JWT_PRIVATE_KEY_PATH') ||
    !!config.get<string>('JWT_PUBLIC_KEY_PEM') ||
    !!config.get<string>('JWT_PUBLIC_KEY_PATH');
  return hasRsa ? 'RS256' : 'HS256';
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

export function requireJwtSigningKey(config: ConfigService): string {
  const alg = getJwtAlgorithm(config);
  if (alg === 'HS256') {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret || !secret.trim()) {
      throw new UnauthorizedException('Configuration JWT manquante');
    }
    return secret;
  }

  const pem =
    config.get<string>('JWT_PRIVATE_KEY_PEM') ||
    (config.get<string>('JWT_PRIVATE_KEY_PATH')
      ? readKeyFromPath(config.get<string>('JWT_PRIVATE_KEY_PATH')!)
      : null);
  if (!pem || !pem.trim()) {
    throw new UnauthorizedException('Configuration JWT manquante');
  }
  return pem;
}

export function requireJwtVerifyKey(config: ConfigService): string {
  const alg = getJwtAlgorithm(config);
  if (alg === 'HS256') {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret || !secret.trim()) {
      throw new UnauthorizedException('Configuration JWT manquante');
    }
    return secret;
  }

  const pem =
    config.get<string>('JWT_PUBLIC_KEY_PEM') ||
    (config.get<string>('JWT_PUBLIC_KEY_PATH')
      ? readKeyFromPath(config.get<string>('JWT_PUBLIC_KEY_PATH')!)
      : null);
  if (!pem || !pem.trim()) {
    throw new UnauthorizedException('Configuration JWT manquante');
  }
  return pem;
}

export function getJwtVerifyAlgorithms(config: ConfigService): Algorithm[] {
  const alg = getJwtAlgorithm(config);
  return [alg] as Algorithm[];
}
