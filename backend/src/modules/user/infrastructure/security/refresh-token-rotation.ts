import { createHmac } from 'node:crypto';

export type RefreshRecord = {
  userId: number;
  credentialVersion?: string;
  nonce: string;
  rotated?: boolean;
};

export function decodeRefreshRecord(raw: unknown): RefreshRecord | null {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 4096) return null;
  try {
    const value = JSON.parse(raw) as RefreshRecord;
    if (
      !value ||
      typeof value !== 'object' ||
      !Number.isSafeInteger(value.userId) ||
      value.userId <= 0 ||
      typeof value.nonce !== 'string' ||
      !/^[a-f0-9]{64}$/.test(value.nonce) ||
      (value.credentialVersion !== undefined &&
        (typeof value.credentialVersion !== 'string' ||
          !/^[a-f0-9]{64}$/.test(value.credentialVersion))) ||
      (value.rotated !== undefined && value.rotated !== true)
    )
      return null;
    return value;
  } catch {
    return null;
  }
}

/** The nonce is server-side. Redis never stores the old or new bearer token. */
export function refreshSuccessor(token: string, nonce: string): string {
  return createHmac('sha384', token)
    .update('lila-refresh-v1\0')
    .update(nonce)
    .digest('base64url');
}

// A lost reply can be retried for 60 seconds, returning the SAME successor.
// Reusing an ancestor after its successor rotates or is revoked is rejected.
export const ROTATE_REFRESH_SCRIPT = `
  local raw = redis.call('GET', KEYS[1])
  if not raw then return 0 end
  if raw ~= ARGV[1] then return -1 end
  local old = cjson.decode(raw)
  if old.rotated then
    local nextRaw = redis.call('GET', KEYS[2])
    if not nextRaw or cjson.decode(nextRaw).rotated then return 0 end
    return 1
  end
  local count = redis.call('SCARD', KEYS[3])
  if count > 254 then
    for _, key in ipairs(redis.call('SMEMBERS', KEYS[3])) do
      if count <= 254 then break end
      if key ~= KEYS[1] and key ~= KEYS[2] then
        redis.call('DEL', key)
        redis.call('SREM', KEYS[3], key)
        count = count - 1
      end
    end
  end
  old.rotated = true
  redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
  redis.call('SET', KEYS[1], cjson.encode(old), 'EX', 60)
  redis.call('SADD', KEYS[3], KEYS[1], KEYS[2])
  redis.call('EXPIRE', KEYS[3], ARGV[3])
  return 1
`;
