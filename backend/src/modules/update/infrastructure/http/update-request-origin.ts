import type { Request } from 'express';

export function getUpdateRequestOrigin(request: Request): string | null {
  const hostHeader =
    (request.headers['x-forwarded-host'] as string | undefined) ||
    request.get('host');
  const host = (hostHeader || '').split(',')[0]?.trim();
  if (!host) return null;
  const protoHeader =
    (request.headers['x-forwarded-proto'] as string | undefined) ||
    request.protocol;
  const proto = (protoHeader || '').split(',')[0]?.trim() || 'https';
  return `${proto}://${host}`;
}
